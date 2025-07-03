import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IncentiveRule from '@/models/IncentiveRule';

// GET: Fetch the current rules from /api/incentives/rules
export async function GET() {
  await dbConnect();
  try {
    const dailyRule = await IncentiveRule.findOne({ type: 'daily' });
    const monthlyRule = await IncentiveRule.findOne({ type: 'monthly' });

    // Return default values if no rules are set in the DB yet
    const defaultDaily = { type: 'daily', target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 }, incentive: { rate: 0.05, applyOn: 'totalSaleValue' } };
    const defaultMonthly = { type: 'monthly', target: { multiplier: 5 }, sales: { includeServiceSale: true, includeProductSale: false, reviewNameValue: 0, reviewPhotoValue: 0 }, incentive: { rate: 0.05, applyOn: 'serviceSaleOnly' } };

    return NextResponse.json({
      daily: dailyRule || defaultDaily,
      monthly: monthlyRule || defaultMonthly
    });
  } catch (error: any) {
    console.error("API GET /api/incentives/rules Error:", error);
    return NextResponse.json({ message: 'Error fetching rules', error: error.message }, { status: 500 });
  }
}

// POST: Create or Update rules at /api/incentives/rules
export async function POST(request: Request) {
  await dbConnect();
  try {
    const { daily, monthly } = await request.json();

    // Use findOneAndUpdate with upsert:true to either create or update the rule
    if (daily) {
      await IncentiveRule.findOneAndUpdate({ type: 'daily' }, daily, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    if (monthly) {
      await IncentiveRule.findOneAndUpdate({ type: 'monthly' }, monthly, { upsert: true, new: true, setDefaultsOnInsert: true });
    }

    return NextResponse.json({ message: 'Incentive rules saved successfully!' }, { status: 200 });

  } catch (error: any)
  {
    console.error("API POST /api/incentives/rules Error:", error);
    return NextResponse.json({ message: 'Error saving rules', error: error.message }, { status: 500 });
  }
}