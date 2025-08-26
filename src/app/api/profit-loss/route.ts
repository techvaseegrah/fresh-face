import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// =========================================================================
//  மாற்றம் 1: உங்கள் தனித்தனி Expense மாடல்களை மீண்டும் import செய்கிறோம்
// =========================================================================
import Invoice from '../../../models/invoice'; // இது வருமானத்திற்கு (Income)
import MonthlyExpense from '../../../models/MonthlyExpense';
import WeeklyExpense from '../../../models/WeeklyExpense';
import DailyExpense from '../../../models/DailyExpense';
import OtherExpense from '../../../models/OtherExpense';

// வருமானத்தைக் கணக்கிடும் Helper Function (இதில் மாற்றம் இல்லை)
const calculateTotalIncome = async (tenantId: string, startDate: Date, endDate: Date) => {
  const result = await Invoice.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        paymentStatus: 'Paid',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: { _id: null, total: { $sum: '$grandTotal' } }
    }
  ]);
  return result.length > 0 ? result[0].total : 0;
};

// =========================================================================
//  மாற்றம் 2: செலவுகளைக் கணக்கிட ஒரு பொதுவான Helper Function
//  இது ஒவ்வொரு Expense மாடலிலும் இருந்து தொகையைக் கணக்கிடும்
// =========================================================================
const calculateTotalForModel = async (model: mongoose.Model<any>, tenantId: string, startDate: Date, endDate: Date) => {
  const result = await model.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: { _id: null, total: { $sum: '$amount' } } // 'amount' புலத்தை கணக்கிடுகிறது
    }
  ]);
  return result.length > 0 ? result[0].total : 0;
};


// GET: Handler to fetch and calculate profit & loss for a specific month
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
      return NextResponse.json({ success: false, message: 'Tenant identification failed.' }, { status: 401 });
    }
    
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.DASHBOARD_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

    // =========================================================================
    //  மாற்றம் 3: வருமானம் மற்றும் அனைத்து செலவுகளையும் ஒரே நேரத்தில் எடுக்கிறோம்
    // =========================================================================
    const [
      totalIncome,
      totalMonthlyExpenses,
      totalWeeklyExpenses,
      totalDailyExpenses,
      totalOtherExpenses
    ] = await Promise.all([
      calculateTotalIncome(tenantId, startDate, endDate),
      calculateTotalForModel(MonthlyExpense, tenantId, startDate, endDate),
      calculateTotalForModel(WeeklyExpense, tenantId, startDate, endDate),
      calculateTotalForModel(DailyExpense, tenantId, startDate, endDate),
      calculateTotalForModel(OtherExpense, tenantId, startDate, endDate)
    ]);

    // மொத்த செலவைக் கணக்கிடுதல்
    const totalExpensesSum = totalMonthlyExpenses + totalWeeklyExpenses + totalDailyExpenses + totalOtherExpenses;
    const sumup = totalIncome - totalExpensesSum;

    // சரியான டேட்டாவை front-end-க்கு அனுப்புதல்
    return NextResponse.json({
      totalIncome,
      totalMonthlyExpenses,
      totalWeeklyExpenses,
      totalDailyExpenses,
      totalOtherExpenses,
      sumup
    });

  } catch (error) {
    console.error('Error calculating profit & loss:', error);
    return NextResponse.json({ message: 'Internal server error', error: (error as Error).message }, { status: 500 });
  }
}