// FILE: /api/customer/route.ts - COMPLETE & FINAL

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import mongoose from 'mongoose';
import { createBlindIndex, generateNgrams } from '@/lib/search-indexing';
import { encrypt, decrypt } from '@/lib/crypto';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
  
    try {
      await connectToDatabase();
      const { searchParams } = new URL(req.url);
      
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '10', 10);
      const skip = (page - 1) * limit;
      const searchQuery = searchParams.get('search')?.trim();
      
      const statusFilter = searchParams.get('status');
      const isMemberFilter = searchParams.get('isMember');
      const lastVisitFrom = searchParams.get('lastVisitFrom');
      const lastVisitTo = searchParams.get('lastVisitTo');
      const genderFilter = searchParams.get('gender');
      const birthdayMonthFilter = searchParams.get('birthdayMonth');
      const nonReturningDaysParam = searchParams.get('nonReturningDays');

      const pipeline: mongoose.PipelineStage[] = [];
      const initialMatchConditions: any[] = [{ isActive: true }];

      if (searchQuery) {
        const isNumeric = /^\d+$/.test(searchQuery);
        if (isNumeric) { initialMatchConditions.push({ phoneSearchIndex: createBlindIndex(searchQuery) }); } 
        else { initialMatchConditions.push({ searchableName: { $regex: searchQuery, $options: 'i' } }); }
      }
      if (isMemberFilter) { initialMatchConditions.push({ isMembership: isMemberFilter === 'true' }); }
      if (genderFilter) { initialMatchConditions.push({ gender: { $regex: `^${genderFilter}$`, $options: 'i' } }); }
      if (birthdayMonthFilter) { initialMatchConditions.push({ $expr: { $eq: [{ $month: { $toDate: "$dob" } }, parseInt(birthdayMonthFilter, 10)] } }); }
      
      pipeline.push({ $match: { $and: initialMatchConditions } });

      pipeline.push({ $lookup: { from: 'appointments', localField: '_id', foreignField: 'customerId', as: 'appointments' } });
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      pipeline.push({
        $addFields: {
          lastAppointment: { $arrayElemAt: [ { $filter: { input: "$appointments", as: "appt", cond: { $eq: ["$$appt.appointmentDateTime", { $max: "$appointments.appointmentDateTime" }] } } }, 0 ] },
          status: { $let: { vars: { lastApptDate: { $max: "$appointments.appointmentDateTime" } }, in: { $cond: { if: { $gt: ["$$lastApptDate", null] }, then: { $cond: { if: { $gte: ["$$lastApptDate", twoMonthsAgo] }, then: "Active", else: "Inactive" } }, else: "New" } } } }
        }
      });
      
      const postMatchConditions: any[] = [];
      
      if (statusFilter === 'Non-returning') {
          const nonReturningDays = parseInt(nonReturningDaysParam || '90', 10);
          if (!isNaN(nonReturningDays) && nonReturningDays > 0) {
              const thresholdDate = new Date();
              thresholdDate.setDate(thresholdDate.getDate() - nonReturningDays);
              postMatchConditions.push({ 'lastAppointment.appointmentDateTime': { $lt: thresholdDate, $ne: null } });
          }
      } else if (statusFilter) {
          postMatchConditions.push({ status: statusFilter });
      }

      if (lastVisitFrom || lastVisitTo) {
          const dateCondition: any = {};
          if (lastVisitFrom) { dateCondition.$gte = new Date(lastVisitFrom); }
          if (lastVisitTo) {
              const toDate = new Date(lastVisitTo);
              toDate.setDate(toDate.getDate() + 1);
              dateCondition.$lt = toDate;
          }
          postMatchConditions.push({ 'lastAppointment.appointmentDateTime': dateCondition });
      }
      
      if (postMatchConditions.length > 0) {
        pipeline.push({ $match: { $and: postMatchConditions } });
      }
      
      const facetStage: mongoose.PipelineStage.Facet = {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit },
            { $lookup: { from: 'serviceitems', localField: 'lastAppointment.serviceIds', foreignField: '_id', as: 'lastServicesDetails' } },
            { $lookup: { from: "loyaltytransactions", localField: "_id", foreignField: "customerId", as: "loyaltyData" } },
            { $project: {
                name: 1, phoneNumber: 1, email: 1, gender: 1, dob: 1, isMembership: 1, membershipBarcode: 1, createdAt: 1, status: 1,
                lastVisitDate: '$lastAppointment.appointmentDateTime',
                lastServices: '$lastServicesDetails.name',
                loyaltyPoints: { $reduce: { input: "$loyaltyData", initialValue: 0, in: { $add: ["$$value", { $cond: [{ $eq: ["$$this.type", "Credit"] }, "$$this.points", { $multiply: ["$$this.points", -1] }] } ] } } }
              }
            }
          ]
        }
      };
      pipeline.push(facetStage);
      
      const [result] = await Customer.aggregate(pipeline);
      const totalCustomers = result.metadata[0] ? result.metadata[0].total : 0;
      const customersFromDb = result.data;
      const customersWithDetails = customersFromDb.map((customer: any) => ({
        ...customer,
        name: customer.name ? decrypt(customer.name) : 'N/A',
        phoneNumber: customer.phoneNumber ? decrypt(customer.phoneNumber) : '',
        email: customer.email ? decrypt(customer.email) : '',
        id: customer._id.toString(),
        appointmentHistory: customer.lastVisitDate ? [{ date: customer.lastVisitDate, services: customer.lastServices || [], _id: '', id: '', status: '', totalAmount: 0, stylistName: '' }] : [],
      }));
      const totalPages = Math.ceil(totalCustomers / limit);
  
      return NextResponse.json({ success: true, customers: customersWithDetails, pagination: { totalCustomers, totalPages, currentPage: page, limit } });
  
    } catch (error: any)      {
      console.error("API Error fetching customers:", error);
      return NextResponse.json({ success: false, message: `Failed to fetch customers: ${error.message}` }, { status: 500 });
    }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_CREATE)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectToDatabase();
    const body = await req.json();
    if (!body.name || !body.phoneNumber) {
        return NextResponse.json({ success: false, message: 'Name and Phone Number are required.' }, { status: 400 });
    }
    if (body.gender) { body.gender = body.gender.toLowerCase(); }
    const normalizedPhoneNumber = String(body.phoneNumber).replace(/\D/g, '');
    const phoneHash = createBlindIndex(normalizedPhoneNumber);
    const phoneSearchIndexes = generateNgrams(normalizedPhoneNumber).map(ngram => createBlindIndex(ngram));
    const existingCustomer = await Customer.findOne({ phoneHash });
    if (existingCustomer) {
        return NextResponse.json({ success: false, message: 'A customer with this phone number already exists.', exists: true, customer: existingCustomer }, { status: 409 });
    }
    const newCustomerData = {
      name: encrypt(body.name), phoneNumber: encrypt(normalizedPhoneNumber), email: body.email ? encrypt(body.email) : undefined,
      phoneHash, searchableName: body.name.toLowerCase(), last4PhoneNumber: normalizedPhoneNumber.slice(-4), phoneSearchIndex: phoneSearchIndexes,
      dob: body.dob || undefined, gender: body.gender || undefined, survey: body.survey || undefined,
    };
    const newCustomer = await Customer.create(newCustomerData);
    return NextResponse.json({ success: true, data: newCustomer }, { status: 201 });
  } catch (error: any) {
    console.error("API Error creating customer:", error);
    if (error.name === 'ValidationError') {
      return NextResponse.json({ success: false, message: `Validation Error: ${error.message}` }, { status: 400 });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json({ success: false, message: `A customer with this ${field} already exists.` }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: "Failed to create customer" }, { status: 500 });
  }
}