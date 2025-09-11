// src/app/api/incentives/calculation/[staffId]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import DailySale from '@/models/DailySale';
import Staff from '@/models/staff';
import IncentiveRule from '@/models/IncentiveRule';
import { getTenantIdOrBail } from '@/lib/tenant';

// A generic type to help TypeScript understand the shape of rule objects
type CalculationRule = {
  target: { multiplier?: number; targetValue?: number; };
  sales: {
    includeServiceSale: boolean;
    includeProductSale: boolean;
    reviewNameValue?: number;
    reviewPhotoValue?: number;
  };
  incentive: {
    rate: number;
    doubleRate: number;
    applyOn?: 'totalSaleValue' | 'serviceSaleOnly';
  };
};

// Your helper functions (unchanged)
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function calculateGenericIncentive(
    achievedValue: number, 
    targetValue: number, 
    rate: number, 
    doubleRate: number,
    baseForIncentive: number
) {
  let incentive = 0;
  let appliedRate = 0;
  const isTargetMet = achievedValue >= targetValue;

  if (isTargetMet && targetValue > 0) {
    const doubleTargetValue = targetValue * 2;
    if (achievedValue >= doubleTargetValue) {
      appliedRate = doubleRate;
      incentive = baseForIncentive * doubleRate;
    } else {
      appliedRate = rate;
      incentive = baseForIncentive * rate;
    }
  }
  return { incentive, isTargetMet, appliedRate };
}

export async function GET(request: Request, { params }: { params: { staffId: string } }) {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(request as any);
    if (tenantId instanceof NextResponse) return tenantId;

    const { staffId } = params;
    const { searchParams } = new URL(request.url);
    const dateQuery = searchParams.get('date');

    if (!dateQuery) {
        return NextResponse.json({ message: 'Date query parameter is required.' }, { status: 400 });
    }

    const staff = await Staff.findOne({ _id: staffId, tenantId }).lean();
    if (!staff || !staff.salary || staff.salary <= 0) {
        return NextResponse.json({ message: 'Staff member not found or their salary is not set.' }, { status: 404 });
    }
    
    const [year, month, day] = dateQuery.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    const dailySaleRecord = await DailySale.findOne({ staff: staffId, date: targetDate, tenantId }).lean();
    const monthlySalesData = await DailySale.find({ staff: staffId, date: { $gte: monthStart, $lte: monthEnd }, tenantId }).lean();

    // ✨ --- THIS IS THE NEW, CORRECT LOGIC BLOCK --- ✨
    let dailyRule, monthlyRule, packageRule, giftCardRule;
    let ruleUsedSource = "Current Rule"; 

    if (dailySaleRecord?.appliedRule) {
        const snapshot = dailySaleRecord.appliedRule as any;
        
        // Case 1: New, complete snapshot exists. Use it directly.
        if (snapshot.daily !== undefined) {
            ruleUsedSource = "Recorded";
            dailyRule = snapshot.daily;
            monthlyRule = snapshot.monthly;
            packageRule = snapshot.package;
            giftCardRule = snapshot.giftCard;
        } 
        // Case 2: Old snapshot format (only daily rule is saved).
        else {
            ruleUsedSource = "Recorded (Old Format)";
            dailyRule = snapshot;
            
            // Perform a precise historical lookup using the sale's creation date.
            const historicalTimestamp = new Date(dailySaleRecord.createdAt);
            
            monthlyRule = await IncentiveRule.findOne({ tenantId, type: 'monthly', createdAt: { $lte: historicalTimestamp } }).sort({ createdAt: -1 }).lean();
            packageRule = await IncentiveRule.findOne({ tenantId, type: 'package', createdAt: { $lte: historicalTimestamp } }).sort({ createdAt: -1 }).lean();
            giftCardRule = await IncentiveRule.findOne({ tenantId, type: 'giftCard', createdAt: { $lte: historicalTimestamp } }).sort({ createdAt: -1 }).lean();
        }
    } else {
        // Case 3: No sale record for the day, so fetch live rules for a preview.
        const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        dailyRule = await IncentiveRule.findOne({ tenantId, type: 'daily', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean();
        monthlyRule = await IncentiveRule.findOne({ tenantId, type: 'monthly', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean();
        packageRule = await IncentiveRule.findOne({ tenantId, type: 'package', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean();
        giftCardRule = await IncentiveRule.findOne({ tenantId, type: 'giftCard', createdAt: { $lte: dayEnd } }).sort({ createdAt: -1 }).lean();
    }
    
    let dailyResult = null, monthlyResult = null, packageResult = null, giftCardResult = null;

    if (dailyRule) {
        const ruleToUse = dailyRule as unknown as CalculationRule;
        const serviceSale = dailySaleRecord?.serviceSale || 0;
        const productSale = dailySaleRecord?.productSale || 0;
        const reviewsWithName = dailySaleRecord?.reviewsWithName || 0;
        const reviewsWithPhoto = dailySaleRecord?.reviewsWithPhoto || 0;
        const daysInMonth = getDaysInMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth());
        const dailyTarget = (staff.salary * (ruleToUse.target.multiplier || 0)) / daysInMonth;
        const reviewNameBonus = reviewsWithName * (ruleToUse.sales.reviewNameValue || 0);
        const reviewPhotoBonus = reviewsWithPhoto * (ruleToUse.sales.reviewPhotoValue || 0);
        const dailyAchievedValue = (ruleToUse.sales.includeServiceSale ? serviceSale : 0) + (ruleToUse.sales.includeProductSale ? productSale : 0) + reviewNameBonus + reviewPhotoBonus;
        const dailyBaseForIncentive = ruleToUse.incentive.applyOn === 'serviceSaleOnly' ? serviceSale : dailyAchievedValue;
        const { incentive, isTargetMet, appliedRate } = calculateGenericIncentive(dailyAchievedValue, dailyTarget, ruleToUse.incentive.rate, ruleToUse.incentive.doubleRate, dailyBaseForIncentive);
        dailyResult = { 
            targetValue: dailyTarget, totalSaleValue: dailyAchievedValue, incentiveAmount: incentive, 
            isTargetMet, appliedRate, ruleUsed: ruleUsedSource,
            details: { serviceSale, productSale, packageSale: dailySaleRecord?.packageSale || 0, giftCardSale: dailySaleRecord?.giftCardSale || 0, reviewNameBonus, reviewPhotoBonus }
        };
    }

    if (monthlyRule) {
        const ruleToUse = monthlyRule as unknown as CalculationRule;
        const totalMonthlyServiceSale = monthlySalesData.reduce((sum, sale) => sum + (sale.serviceSale || 0), 0);
        const totalMonthlyProductSale = monthlySalesData.reduce((sum, sale) => sum + (sale.productSale || 0), 0);
        const monthlyTarget = staff.salary * (ruleToUse.target.multiplier || 0);
        const monthlyAchievedValue = (ruleToUse.sales.includeServiceSale ? totalMonthlyServiceSale : 0) + (ruleToUse.sales.includeProductSale ? totalMonthlyProductSale : 0);
        const monthlyBaseForIncentive = ruleToUse.incentive.applyOn === 'serviceSaleOnly' ? totalMonthlyServiceSale : monthlyAchievedValue;
        const { incentive, isTargetMet, appliedRate } = calculateGenericIncentive(monthlyAchievedValue, monthlyTarget, ruleToUse.incentive.rate, ruleToUse.incentive.doubleRate, monthlyBaseForIncentive);
        monthlyResult = { targetValue: monthlyTarget, totalSaleValue: monthlyAchievedValue, incentiveAmount: incentive, isTargetMet, appliedRate };
    }

    if (packageRule) {
        const ruleToUse = packageRule as unknown as CalculationRule;
        const totalPackageSale = monthlySalesData.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
        const packageTarget = ruleToUse.target.targetValue || 0;
        const { incentive, isTargetMet, appliedRate } = calculateGenericIncentive(totalPackageSale, packageTarget, ruleToUse.incentive.rate, ruleToUse.incentive.doubleRate, totalPackageSale);
        packageResult = { targetValue: packageTarget, totalSaleValue: totalPackageSale, incentiveAmount: incentive, isTargetMet, appliedRate };
    }
    
    if (giftCardRule) {
        const ruleToUse = giftCardRule as unknown as CalculationRule;
        const totalGiftCardSale = monthlySalesData.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
        const giftCardTarget = ruleToUse.target.targetValue || 0;
        const { incentive, isTargetMet, appliedRate } = calculateGenericIncentive(totalGiftCardSale, giftCardTarget, ruleToUse.incentive.rate, ruleToUse.incentive.doubleRate, totalGiftCardSale);
        giftCardResult = { targetValue: giftCardTarget, totalSaleValue: totalGiftCardSale, incentiveAmount: incentive, isTargetMet, appliedRate };
    }

    return NextResponse.json({
        staffName: staff.name,
        calculationDate: targetDate.toISOString().split('T')[0],
        incentive1_daily: dailyResult,
        incentive2_monthly: monthlyResult,
        incentive3_package: packageResult,
        incentive4_giftCard: giftCardResult,
    });

  } catch (error: any) {
    console.error("--- FATAL ERROR in /api/incentives/calculation/[staffId] ---", error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}