import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IncentiveRule from '@/models/IncentiveRule';

// The interface for our Rule object, ensuring type safety.
interface IRule {
  type: 'daily' | 'monthly';
  target: { multiplier: number };
  sales: {
    includeServiceSale: boolean;
    includeProductSale: boolean;
    reviewNameValue: number;
    reviewPhotoValue: number;
  };
  incentive: {
    rate: number;
    doubleRate: number;
    applyOn: 'totalSaleValue' | 'serviceSaleOnly';
  };
}

// GET: Fetch the current rules from /api/incentives/rules
export async function GET() {
  await dbConnect();
  try {
    // Fetch rules from the database as plain JavaScript objects.
    const dailyRuleDb = await IncentiveRule.findOne({ type: 'daily' }).lean<IRule>();
    const monthlyRuleDb = await IncentiveRule.findOne({ type: 'monthly' }).lean<IRule>();

    // Define the complete default objects. These act as a fallback.
    const defaultDaily: IRule = {
      type: 'daily',
      target: { multiplier: 5 },
      sales: { includeServiceSale: true, includeProductSale: true, reviewNameValue: 200, reviewPhotoValue: 300 },
      incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'totalSaleValue' }
    };
    const defaultMonthly: IRule = {
      type: 'monthly',
      target: { multiplier: 5 },
      sales: { includeServiceSale: true, includeProductSale: false, reviewNameValue: 0, reviewPhotoValue: 0 },
      incentive: { rate: 0.05, doubleRate: 0.10, applyOn: 'serviceSaleOnly' }
    };

    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!   THIS IS THE NEW, CORRECTED LOGIC     !!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // It correctly merges the nested 'incentive' object.
    const daily: IRule = {
        ...defaultDaily,
        ...dailyRuleDb,
        incentive: {
            ...defaultDaily.incentive,
            ...(dailyRuleDb?.incentive || {}), // The DB incentive object overwrites the default.
        },
    };

    const monthly: IRule = {
        ...defaultMonthly,
        ...monthlyRuleDb,
        incentive: {
            ...defaultMonthly.incentive,
            ...(monthlyRuleDb?.incentive || {}), // The DB incentive object overwrites the default.
        },
    };

    return NextResponse.json({ daily, monthly });

  } catch (error: any) {
    console.error("API GET /api/incentives/rules Error:", error);
    return NextResponse.json({ message: 'Error fetching rules', error: error.message }, { status: 500 });
  }
}

// POST: Create or Update rules (This part was already correct and needs no changes)
export async function POST(request: Request) {
  await dbConnect();
  try {
    const { daily, monthly } = await request.json();

    if (daily) {
      await IncentiveRule.findOneAndUpdate({ type: 'daily' }, daily, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    if (monthly) {
      await IncentiveRule.findOneAndUpdate({ type: 'monthly' }, monthly, { upsert: true, new: true, setDefaultsOnInsert: true });
    }

    return NextResponse.json({ message: 'Incentive rules saved successfully!' }, { status: 200 });

  } catch (error: any) {
    console.error("API POST /api/incentives/rules Error:", error);
    return NextResponse.json({ message: 'Error saving rules', error: error.message }, { status: 500 });
  }
}