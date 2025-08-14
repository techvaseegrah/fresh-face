// /app/api/customer/export/route.ts - MULTI-TENANT VERSION (Corrected Permission)

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Customer from '@/models/customermodel';
import Appointment from '@/models/Appointment';
import LoyaltyTransaction from '@/models/loyaltyTransaction';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { getTenantIdOrBail } from '@/lib/tenant';
import { decrypt } from '@/lib/crypto';

// Helper to format a date string or return 'N/A'
const formatDateForExport = (date?: string | Date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

export async function GET(req: Request) {
  // Authentication and Authorization
  const session = await getServerSession(authOptions);

  // --- MODIFIED SECTION START ---
  // The permission check is now updated to use CUSTOMERS_EXPORT,
  // aligning with the frontend button's logic.
  if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_EXPORT)) {
    return NextResponse.json({ success: false, message: 'Unauthorized: Missing export permission.' }, { status: 403 }); // Use 403 Forbidden
  }
  // --- MODIFIED SECTION END ---

  // Get Tenant ID or fail early
  const tenantId = getTenantIdOrBail(req as any);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  try {
    await connectToDatabase();

    // Fetch ALL customers for the CURRENT TENANT without pagination
    console.log(`Starting export process for tenant ${tenantId}...`);
    // Note: The original code used isActive: true. If you want to export ALL customers
    // (including inactive), you can remove that filter. Kept it for consistency.
    const allCustomers = await Customer.find({ isActive: true, tenantId }).sort({ createdAt: -1 }).lean();

    if (allCustomers.length === 0) {
      return NextResponse.json({ success: false, message: 'No customers to export' }, { status: 404 });
    }
    
    const allCustomerIds = allCustomers.map(c => c._id);
    
    // Fetch all related data, SCOPED TO THE TENANT, in parallel
    console.log(`Fetching related data for ${allCustomerIds.length} customers...`);
    const [allLatestAppointments, allLoyaltyPoints] = await Promise.all([
      Appointment.aggregate([
        // Critical: Match both customer IDs AND the tenantId
        { $match: { customerId: { $in: allCustomerIds }, tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $addFields: { unifiedDate: { $ifNull: ["$appointmentDateTime", "$date"] } } },
        { $sort: { unifiedDate: -1 } },
        { $lookup: { from: 'serviceitems', localField: 'serviceIds', foreignField: '_id', as: 'populatedServices' } },
        { $group: { _id: '$customerId', lastAppointmentDate: { $first: '$unifiedDate' }, lastServicesDetails: { $first: '$populatedServices' } } }
      ]),
      LoyaltyTransaction.aggregate([
        // Critical: Match both customer IDs AND the tenantId
        { $match: { customerId: { $in: allCustomerIds }, tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $group: { _id: '$customerId', totalPoints: { $sum: { $cond: [{ $eq: ['$type', 'Credit'] }, '$points', { $multiply: ['$points', -1] }] } } } }
      ])
    ]);

    const appointmentMap = new Map(allLatestAppointments.map(a => [a._id.toString(), a]));
    const loyaltyMap = new Map(allLoyaltyPoints.map(l => [l._id.toString(), l.totalPoints]));

    // Format the data for the worksheet
    console.log("Formatting data for Excel worksheet...");
    const formattedData = allCustomers.map((customer: any) => {
      const appointmentDetails = appointmentMap.get(customer._id.toString());
      const loyaltyPoints = loyaltyMap.get(customer._id.toString()) || 0;

      // Decrypt fields before exporting
      return {
        'Name': decrypt(customer.name),
        'Email': customer.email ? decrypt(customer.email) : 'N/A',
        'Phone Number': decrypt(customer.phoneNumber),
        'Membership': customer.isMembership ? 'Yes' : 'No',
        'Loyalty Points': loyaltyPoints,
        'Date of Birth': formatDateForExport(customer.dob),
        'Gender': customer.gender ?? 'N/A',
        'Last Visit Date': formatDateForExport(appointmentDetails?.lastAppointmentDate),
        'Last Services': appointmentDetails?.lastServicesDetails?.map((s: any) => s.name).join(', ') || 'N/A',
        'Joined On': formatDateForExport(customer.createdAt),
      };
    });

    // Create the Excel file in memory
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    
    worksheet['!cols'] = [ { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 18 }, { wch: 40 }, { wch: 18 }];

    // Generate the file buffer
    console.log("Generating XLSX buffer...");
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Return the file as a response
    console.log("Sending file to client.");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="All_Customers_${new Date().toISOString().split('T')[0]}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

  } catch (error: any) {
    console.error("API Error during export:", error);
    return NextResponse.json({ success: false, message: "Failed to export customers" }, { status: 500 });
  }
}