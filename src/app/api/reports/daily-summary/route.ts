import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb'; // Corrected import name for consistency
import Invoice from '@/models/invoice';
import DayEndReport from '@/models/DayEndReport';
import Expense from '@/models/Expense';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant'; // 👈 IMPORTED: The standard tenant helper

export async function GET(request: NextRequest) {
  try {
    // --- 1. Get Tenant ID using the standard helper FIRST ---
    const tenantId = getTenantIdOrBail(request);
    if (tenantId instanceof NextResponse) {
      return tenantId; // Bail out if the tenant header is missing
    }
    // --------------------------------------------------------

    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DAYEND_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    // --- 2. Security Safeguard: Verify session tenant matches header tenant ---
    if (session.user.tenantId !== tenantId) {
      console.warn(`Security Alert: Session tenant (${session.user.tenantId}) does not match header tenant (${tenantId}).`);
      return NextResponse.json({ success: false, message: 'Session-Tenant mismatch.' }, { status: 403 });
    }
    // -----------------------------------------------------------------------

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, message: "Invalid date format. Please use YYYY-MM-DD." }, { status: 400 });
    }

    await connectToDatabase();

    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);

    // This logic was already perfectly tenant-aware. No changes needed here.
    const [paidInvoices, lastClosingReport, dailyExpenses] = await Promise.all([
      Invoice.find({ 
        paymentStatus: 'Paid', 
        createdAt: { $gte: startDate, $lte: endDate },
        tenantId: tenantId // Filter by tenant
      }).lean(),
      DayEndReport.findOne({ 
        closingDate: { $lt: startDate },
        tenantId: tenantId // Filter by tenant
      }).sort({ closingDate: -1 }).lean(),
      Expense.find({ 
        date: { $gte: startDate, $lte: endDate },
        tenantId: tenantId // Filter by tenant
      }).lean()
    ]);

    // The rest of the data processing logic is correct and remains unchanged.
    const expectedTotals = paidInvoices.reduce((acc, inv) => {
      acc.total += inv.grandTotal || 0;
      if (inv.paymentDetails && typeof inv.paymentDetails === 'object') {
        for (const [method, amount] of Object.entries(inv.paymentDetails)) {
          if (typeof amount === 'number') {
            acc[method] = (acc[method] || 0) + amount;
          }
        }
      }
      return acc;
    }, { cash: 0, card: 0, upi: 0, other: 0, total: 0 } as any);
    
    const openingBalance = lastClosingReport?.actualTotals?.totalCountedCash || 0;
    
    const totalCashExpenses = dailyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    return NextResponse.json({
      success: true,
      data: {
        openingBalance,
        expectedTotals,
        pettyCash: {
          total: totalCashExpenses,
          entries: dailyExpenses.map(e => ({ 
            _id: e._id.toString(), 
            description: e.description || e.type,
            amount: e.amount 
          })),
        },
      },
    });

  } catch (error: any) {
    console.error("API Error in /api/reports/daily-summary:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}