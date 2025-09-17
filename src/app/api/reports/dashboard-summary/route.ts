// src/app/api/reports/dashboard-summary/route.ts - CORRECTED

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';
import { isWithinInterval, startOfDay, endOfDay, format, getMonth, getYear } from 'date-fns';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/auth';

// Import all necessary models
import Invoice from '@/models/invoice';
import Appointment from '@/models/Appointment';
import LeaveRequest from '@/models/LeaveRequest';
import { GiftCard } from '@/models/GiftCard';
import CustomerPackage from '@/models/CustomerPackage';
import TargetSheet from '@/models/TargetSheet';
import SalaryRecord from '@/models/SalaryRecord';
import Tool from '@/models/Tool';
import EBReading from '@/models/ebReadings';
import SopSubmission from '@/models/SopSubmission';
import Task from '@/models/Task';
import Issue from '@/models/Issue';
import Expense from '@/models/Expense';
import Budget from '@/models/Budget';
import '@/models/staff';

export const dynamic = 'force-dynamic';

// --- TYPE DEFINITIONS ---
interface ITarget {
  service: number;
  retail: number;
  bills?: number;
  abv?: number;
  callbacks?: number;
  appointments?: number;
}

interface ITargetSheet {
  target: ITarget;
}

interface ILeaveRequest {
    status: 'Pending' | 'Approved' | 'Rejected';
    startDate: Date;
    endDate: Date;
}
interface AggregationResult { _id: null; [key: string]: any; }
interface TopPerformerResult { _id: string; name: string; totalSales: number; }
interface StatusCountResult { _id: string; count: number; }

const sumAsNumber = (field: string) => ({ $sum: { $toDouble: field } });

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
        return NextResponse.json({ success: false, message: 'Authentication failed: No tenant ID found in session.' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    
    await dbConnect();
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ success: false, message: 'Start and end date are required.' }, { status: 400 });
    }

    const startDate = startOfDay(new Date(startDateParam));
    const endDate = endOfDay(new Date(endDateParam));
    const queryMonth = getMonth(startDate) + 1;
    const queryYear = getYear(startDate);
    const monthIdentifier = format(startDate, 'yyyy-MM');

    const [
      salesData,
      appointmentCount,
      leaveData,
      giftCardSales,
      packageSales,
      targetDoc, 
      salaryData,
      topPerformerData,
      lowStockToolCount,
      latestEBReading,
      sopStatusCounts,
      taskStatusCounts,
      pendingIssuesCount,
      totalExpenses,
      budgetData,
    ] = await Promise.all([
      Invoice.aggregate<AggregationResult>([ { $match: { tenantId: tenantObjectId, paymentStatus: 'Paid' } }, { $lookup: { from: 'appointments', localField: 'appointmentId', foreignField: '_id', as: 'appointmentInfo' }}, { $unwind: '$appointmentInfo' }, { $match: { 'appointmentInfo.appointmentDateTime': { $gte: startDate, $lte: endDate } }}, { $group: { _id: null, totalSales: sumAsNumber('$grandTotal'), totalInvoices: { $sum: 1 }}}, ]),
      Appointment.countDocuments({ tenantId: tenantObjectId, appointmentDateTime: { $gte: startDate, $lte: endDate } }),
      LeaveRequest.find({ tenantId: tenantObjectId }).lean(),
      
      // ▼▼▼ THIS IS THE FIX ▼▼▼
      // The date filter { issueDate: { $gte: startDate, $lte: endDate } } is now correctly applied.
      GiftCard.aggregate<AggregationResult>([
        { $match: { tenantId: tenantObjectId, issueDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, totalValue: sumAsNumber('$initialBalance') } },
      ]),
      
      // The date filter { purchaseDate: { $gte: startDate, $lte: endDate } } is now correctly applied.
      CustomerPackage.aggregate<AggregationResult>([
        { $match: { tenantId: tenantObjectId, purchaseDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, totalValue: sumAsNumber('$purchasePrice') } },
      ]),
      // ▲▲▲ END OF FIX ▲▲▲
      
      TargetSheet.findOne<ITargetSheet>({ tenantId: tenantObjectId, month: monthIdentifier }).lean(),
      SalaryRecord.aggregate<AggregationResult>([ { $match: { tenantId: tenantObjectId, isPaid: true, paidDate: { $gte: startDate, $lte: endDate } }}, { $group: { _id: null, totalPaid: sumAsNumber('$netSalary') }} ]),
      Invoice.aggregate<TopPerformerResult>([ { $match: { tenantId: tenantObjectId, paymentStatus: 'Paid' } }, { $lookup: { from: 'appointments', localField: 'appointmentId', foreignField: '_id', as: 'appointmentInfo' }}, { $unwind: '$appointmentInfo' }, { $match: { 'appointmentInfo.appointmentDateTime': { $gte: startDate, $lte: endDate } }}, { $unwind: '$lineItems' }, { $addFields: { 'effectiveStaffId': { $ifNull: ['$lineItems.staffId', '$stylistId'] } } }, { $group: { _id: '$effectiveStaffId', totalSales: sumAsNumber('$lineItems.finalPrice') } }, { $sort: { totalSales: -1 } }, { $limit: 1 }, { $lookup: { from: 'staffs', localField: '_id', foreignField: '_id', as: 'staffInfo' } }, { $unwind: { path: '$staffInfo', preserveNullAndEmptyArrays: true } }, { $project: { _id: '$_id', name: { $ifNull: ['$staffInfo.name', 'Unknown Staff'] }, totalSales: '$totalSales' } } ]),
      Tool.countDocuments({ tenantId: tenantObjectId, currentStock: { $lt: 5 } }),
      EBReading.findOne({ tenantId: tenantObjectId }).sort({ readingDate: -1 }).lean(),
      SopSubmission.aggregate<StatusCountResult>([ { $match: { tenantId: tenantObjectId, submissionDate: { $gte: startDate, $lte: endDate } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ]),
      Task.aggregate<StatusCountResult>([ { $match: { tenantId: tenantObjectId, dueDate: { $gte: startDate, $lte: endDate } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ]),
      Issue.countDocuments({ tenantId: tenantObjectId, status: { $in: ['pending_review', 'pending_assignment', 'ongoing'] }, createdAt: { $gte: startDate, $lte: endDate } }),
      Expense.aggregate<AggregationResult>([ { $match: { tenantId: tenantObjectId, date: { $gte: startDate, $lte: endDate } } }, { $group: { _id: null, total: sumAsNumber('$amount') } } ]),
      Budget.aggregate([ { $match: { tenantId: tenantObjectId, month: queryMonth, year: queryYear } }, { $project: { allExpenses: { $concatArrays: ["$fixedExpenses", "$variableExpenses"] } } }, { $unwind: "$allExpenses" }, { $group: { _id: null, total: { $sum: "$allExpenses.amount" } } } ]),
    ]);

    // Process new data
    const sopStats = sopStatusCounts.reduce((acc: Record<string, number>, item) => {
        acc[item._id] = item.count;
        return acc;
    }, {});

    const taskStats = taskStatusCounts.reduce((acc: Record<string, number>, item) => {
        const key = item._id.toLowerCase().replace(/\s/g, '_');
        acc[key] = item.count;
        return acc;
    }, {});

    const totalBudgetForMonth = budgetData?.[0]?.total ?? 0;
    const totalExpensesForMonth = totalExpenses?.[0]?.total ?? 0;
    
    const budgetUsagePercentage = totalBudgetForMonth > 0 ? (totalExpensesForMonth / totalBudgetForMonth) * 100 : 0;

    const today = new Date();
    const pendingLeaveRequests = Array.isArray(leaveData) ? leaveData.filter((req: ILeaveRequest) => req.status === 'Pending').length : 0;
    const staffOnLeaveToday = Array.isArray(leaveData) ? leaveData.filter((req: ILeaveRequest) => req.status === 'Approved' && isWithinInterval(today, { start: startOfDay(req.startDate), end: endOfDay(req.endDate) })).length : 0;
    const actualTotalSales = salesData?.[0]?.totalSales ?? 0;
    
    const netSalesTarget = (targetDoc?.target?.service ?? 0) + (targetDoc?.target?.retail ?? 0);

    const summary = {
      totalSales: actualTotalSales,
      totalInvoices: salesData?.[0]?.totalInvoices ?? 0,
      appointmentCount: appointmentCount || 0,
      pendingLeaveRequests,
      staffOnLeaveToday,
      pendingAdvances: 0,
      pendingAdvanceAmount: 0,
      giftCardsSoldValue: giftCardSales?.[0]?.totalValue ?? 0,
      packagesSoldValue: packageSales?.[0]?.totalValue ?? 0,
      targetAchieved: actualTotalSales,
      targetGoal: netSalesTarget,
      totalSalaryPaid: salaryData?.[0]?.totalPaid ?? 0,
      topPerformer: topPerformerData?.[0] ?? null,
      lowStockToolCount: lowStockToolCount || 0,
      latestEBReading: latestEBReading ? {
        reading: (latestEBReading as any).reading,
        date: (latestEBReading as any).readingDate,
      } : null,
      sopStats: {
          pending: sopStats['pending_review'] || 0,
          approved: sopStats['approved'] || 0,
          rejected: sopStats['rejected'] || 0,
      },
      taskStats: {
          pending: taskStats['awaiting_review'] || 0,
          approved: taskStats['approved'] || 0,
          rejected: taskStats['rejected'] || 0,
      },
      pendingIssuesCount: pendingIssuesCount || 0,
      totalExpenses: totalExpensesForMonth,
      budgetUsage: {
          percentage: budgetUsagePercentage,
          totalBudget: totalBudgetForMonth,
      },
    };

    return NextResponse.json({ success: true, data: summary });

  } catch (error: any) {
    console.error("API Error fetching dashboard summary:", error);
    return NextResponse.json({ success: false, message: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}