import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { getTenantIdOrBail } from '@/lib/tenant';
import { decrypt } from '@/lib/crypto';

// --- Import ALL necessary models ---
import Staff from '@/models/staff';
import ShopSetting from '@/models/ShopSetting';
import Attendance, { IAttendance } from '@/models/Attendance';
import AdvancePayment from '@/models/advance';
import SalaryRecord from '@/models/SalaryRecord';
import DailySale from '@/models/DailySale';
import IncentivePayout from '@/models/IncentivePayout';
import Shift, { IShift } from '@/models/Shift';
import IncentiveRule from '@/models/IncentiveRule';
import Appointment from '@/models/Appointment';
import Customer from '@/models/customermodel';
import ServiceItem from '@/models/ServiceItem';
import LeaveRequest from '@/models/LeaveRequest';
import Invoice from '@/models/invoice'; // Invoice model is crucial


// --- Helper Types (Unchanged) ---
type DailyRule = {
  target: { multiplier: number };
  sales: { 
    includeServiceSale: boolean; 
    includeProductSale: boolean; 
    includePackageSale?: boolean;
    includeGiftCardSale?: boolean;
    reviewNameValue: number; 
    reviewPhotoValue: number; 
  };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
};
type MonthlyRule = {
  target: { multiplier: number };
  sales: { includeServiceSale: boolean; includeProductSale: boolean; };
  incentive: { rate: number; doubleRate: number; applyOn: 'totalSaleValue' | 'serviceSaleOnly'; };
}
type FixedTargetRule = {
    target: { targetValue: number };
    incentive: { rate: number; doubleRate: number };
}

// --- Helper Functions (Unchanged) ---
function getDaysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }

function calculateIncentive(achieved: number, target: number, rate: number, doubleRate: number, base: number) {
    if (achieved < target || target <= 0) return { incentive: 0, isTargetMet: false, appliedRate: 0 };
    const doubleTarget = target * 2;
    const appliedRate = achieved >= doubleTarget ? doubleRate : rate;
    return { incentive: base * appliedRate, isTargetMet: true, appliedRate };
}

function findHistoricalRule<T>(rules: T[], timestamp: Date): T | null {
    if (!rules || rules.length === 0) return null;
    const sortedRules = rules.sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime());
    return sortedRules.find(rule => new Date((rule as any).createdAt) <= timestamp) || null;
}

function calculateTotalCumulativeMonthly(sales: any[], staff: any, rule: MonthlyRule | null) {
    if (!rule) return 0;
    const totalService = sales.reduce((sum, s) => sum + (s.serviceSale || 0), 0);
    const totalProduct = sales.reduce((sum, s) => sum + (s.productSale || 0), 0);
    const target = (staff.salary || 0) * rule.target.multiplier;
    const achieved = (rule.sales.includeServiceSale ? totalService : 0) + (rule.sales.includeProductSale ? totalProduct : 0);
    const base = rule.incentive.applyOn === 'serviceSaleOnly' ? totalService : achieved;
    return calculateIncentive(achieved, target, rule.incentive.rate, rule.incentive.doubleRate, base).incentive;
}

// ✅ FIX: This entire function is now updated to correctly calculate incentives based on NET sales.
async function calculateMonthlyIncentive(staffId: string, tenantId: string, monthStart: Date, monthEnd: Date): Promise<number> {
    const [staff, grossSalesInMonth, allRules, allInvoicesInRange] = await Promise.all([
        Staff.findById(staffId).lean(),
        DailySale.find({ staff: staffId, tenantId, date: { $gte: monthStart, $lte: monthEnd } }).sort({ date: 'asc' }).lean(),
        (async () => {
            const rules = await IncentiveRule.find({ tenantId }).sort({ createdAt: -1 }).lean();
            return {
                daily: rules.filter(r => r.type === 'daily'),
                monthly: rules.filter(r => r.type === 'monthly'),
                package: rules.filter(r => r.type === 'package'),
                giftCard: rules.filter(r => r.type === 'giftCard'),
            };
        })(),
        Invoice.find({ tenantId: tenantId, createdAt: { $gte: monthStart, $lte: monthEnd }, 'manualDiscount.appliedAmount': { $gt: 0 } }).lean()
    ]);

    if (!staff || !staff.salary) return 0;
    if (grossSalesInMonth.length === 0) return 0;

    // First, create a single source of truth for NET sales data
    const netSalesInMonth = grossSalesInMonth.map(sale => {
        let netServiceSale = sale.serviceSale || 0;
        const saleDateString = new Date(sale.date).toISOString().split('T')[0];
        const invoicesForDay = allInvoicesInRange.filter(inv => new Date(inv.createdAt).toISOString().split('T')[0] === saleDateString);
        for (const invoice of invoicesForDay) {
            const manualDiscountAmount = invoice.manualDiscount?.appliedAmount || 0;
            let totalServiceValueOnInvoice = 0, staffServiceValueOnInvoice = 0;
            for (const item of (invoice.lineItems || [])) {
                if (item.itemType === 'service') {
                    totalServiceValueOnInvoice += item.finalPrice;
                    if (item.staffId?.toString() === staffId) { staffServiceValueOnInvoice += item.finalPrice; }
                }
            }
            if (totalServiceValueOnInvoice > 0 && staffServiceValueOnInvoice > 0) {
                const staffShareOfDiscount = (manualDiscountAmount * staffServiceValueOnInvoice) / totalServiceValueOnInvoice;
                netServiceSale -= staffShareOfDiscount;
            }
        }
        return { ...sale, serviceSale: netServiceSale };
    });

    let totalEarned = 0;
    // Now, loop through the corrected NET sales data to calculate total incentive
    for (let i = 0; i < netSalesInMonth.length; i++) {
        const saleForThisDay = netSalesInMonth[i];
        const d = new Date(saleForThisDay.date);
        const historicalTimestamp = new Date(saleForThisDay.createdAt || saleForThisDay.date);

        const dailyRule = findHistoricalRule(allRules.daily, historicalTimestamp) as DailyRule | null;
        const monthlyRule = findHistoricalRule(allRules.monthly, historicalTimestamp) as MonthlyRule | null;
        const packageRule = findHistoricalRule(allRules.package, historicalTimestamp) as FixedTargetRule | null;
        const giftCardRule = findHistoricalRule(allRules.giftCard, historicalTimestamp) as FixedTargetRule | null;

        let dailyIncentive = 0;
        if (dailyRule) {
            const daysInMonth = getDaysInMonth(d.getFullYear(), d.getMonth());
            const target = (staff.salary * dailyRule.target.multiplier) / daysInMonth;
            const reviewBonus = (saleForThisDay.reviewsWithName * (dailyRule.sales.reviewNameValue || 0)) + (saleForThisDay.reviewsWithPhoto * (dailyRule.sales.reviewPhotoValue || 0));
            const achieved = (dailyRule.sales.includeServiceSale ? saleForThisDay.serviceSale : 0) 
                           + (dailyRule.sales.includeProductSale ? (saleForThisDay.productSale || 0) : 0)
                           + (dailyRule.sales.includePackageSale ? (saleForThisDay.packageSale || 0) : 0)
                           + (dailyRule.sales.includeGiftCardSale ? (saleForThisDay.giftCardSale || 0) : 0)
                           + reviewBonus;
            const base = dailyRule.incentive.applyOn === 'serviceSaleOnly' ? saleForThisDay.serviceSale : achieved;
            dailyIncentive = calculateIncentive(achieved, target, dailyRule.incentive.rate, dailyRule.incentive.doubleRate, base).incentive;
        }

        const salesUpToToday = netSalesInMonth.slice(0, i + 1);
        const salesUpToYesterday = netSalesInMonth.slice(0, i);
        const yesterdayTimestamp = i > 0 ? new Date(salesUpToYesterday[i - 1].createdAt || d) : d;
        const monthlyRuleYesterday = findHistoricalRule(allRules.monthly, yesterdayTimestamp) as MonthlyRule | null;
        const cumulativeToday = calculateTotalCumulativeMonthly(salesUpToToday, staff, monthlyRule);
        const cumulativeYesterday = calculateTotalCumulativeMonthly(salesUpToYesterday, staff, monthlyRuleYesterday);
        const monthlyIncentiveDelta = cumulativeToday - cumulativeYesterday;

        let packageIncentiveToday = 0;
        if (packageRule) {
            const totalPackageSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.packageSale || 0), 0);
            const { isTargetMet, appliedRate } = calculateIncentive(totalPackageSaleMonth, packageRule.target.targetValue, packageRule.incentive.rate, packageRule.incentive.doubleRate, totalPackageSaleMonth);
            if (isTargetMet) { packageIncentiveToday = (saleForThisDay.packageSale || 0) * appliedRate; }
        }

        let giftCardIncentiveToday = 0;
        if (giftCardRule) {
            const totalGiftCardSaleMonth = salesUpToToday.reduce((sum, sale) => sum + (sale.giftCardSale || 0), 0);
            const { isTargetMet, appliedRate } = calculateIncentive(totalGiftCardSaleMonth, giftCardRule.target.targetValue, giftCardRule.incentive.rate, giftCardRule.incentive.doubleRate, totalGiftCardSaleMonth);
            if (isTargetMet) { giftCardIncentiveToday = (saleForThisDay.giftCardSale || 0) * appliedRate; }
        }
        
        totalEarned += dailyIncentive + monthlyIncentiveDelta + packageIncentiveToday + giftCardIncentiveToday;
    }
    
    return totalEarned;
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role.name !== 'staff') {
        return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 });
    }

    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) {
        return tenantIdOrResponse;
    }
    const tenantId = tenantIdOrResponse;
    const staffObjectId = session.user.id;

    try {
        await dbConnect();
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        const [
            settings,
            staffMember,
            attendanceRecords,
            advanceRecords,
            salaryRecords,
            monthlyPerformance,
            payoutRecords,
            todayShiftRecord,
            todaysAppointments,
            recentLeaveRequests,
            invoicesWithDiscounts,
        ] = await Promise.all([
            ShopSetting.findOne({ key: 'defaultSettings', tenantId }).lean(),
            Staff.findById(staffObjectId).select('position').lean(),
            Attendance.find({ staffId: staffObjectId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean<IAttendance[]>(),
            AdvancePayment.find({ staffId: staffObjectId, tenantId: tenantId, requestDate: { $gte: monthStart, $lte: monthEnd } }).sort({ requestDate: -1 }).lean(),
            SalaryRecord.find({ staffId: staffObjectId, tenantId: tenantId }).sort({ year: -1, 'month.index': -1 }).limit(12).lean(),
            DailySale.find({ staff: staffObjectId, tenantId: tenantId, date: { $gte: monthStart, $lte: monthEnd } }).lean(),
            IncentivePayout.find({ staff: staffObjectId, tenantId: tenantId, createdAt: { $gte: monthStart, $lte: monthEnd } }).lean(),
            Shift.findOne({ employeeId: staffObjectId, tenantId: tenantId, date: { $gte: startOfDay(now), $lte: endOfDay(now) } }).lean<IShift | null>(),
            Appointment.find({
                stylistId: staffObjectId,
                tenantId: tenantId,
                appointmentDateTime: { $gte: todayStart, $lte: todayEnd },
                status: { $in: ['Appointment', 'Checked-In'] }
            })
            .populate({ path: 'customerId', select: 'name' })
            .populate({ path: 'serviceIds', select: 'name' })
            .sort({ appointmentDateTime: 1 })
            .lean(),
            LeaveRequest.find({ staff: staffObjectId, tenantId: tenantId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            Invoice.find({
                tenantId: tenantId,
                createdAt: { $gte: monthStart, $lte: monthEnd },
                'manualDiscount.appliedAmount': { $gt: 0 }
            }).lean()
        ]);

        let requiredMinutes = 0;
        if (settings && staffMember) {
            const positionHoursMap = new Map(settings.positionHours?.map((p: any) => [p.positionName, p.requiredHours]) || []);
            if (staffMember.position && positionHoursMap.has(staffMember.position)) {
                requiredMinutes = (positionHoursMap.get(staffMember.position) ?? 0) * 60;
            } else {
                requiredMinutes = (settings.defaultDailyHours || 9) * 22 * 60;
            }
        } else if (attendanceRecords.length > 0) {
            requiredMinutes = attendanceRecords.reduce((total, record) => {
                if (record.status === 'present' || record.status === 'incomplete') return total + (record.requiredMinutes || 0);
                return total;
            }, 0);
        }
        const achievedMinutes = attendanceRecords.reduce((sum, record) => sum + (record.totalWorkingMinutes || 0), 0);
        const todayShift = todayShiftRecord ? (todayShiftRecord.isWeekOff ? "Week Off" : todayShiftRecord.shiftTiming) : "Not Assigned";
        
        let correctedTotalSales = 0;
        const staffObjectIdString = staffObjectId.toString();

        for (const daySale of monthlyPerformance) {
            let netServiceSaleForDay = daySale.serviceSale || 0;
            const saleDateString = new Date(daySale.date).toISOString().split('T')[0];
            const invoicesForDay = invoicesWithDiscounts.filter(inv => new Date(inv.createdAt).toISOString().split('T')[0] === saleDateString);

            for (const invoice of invoicesForDay) {
                const manualDiscountAmount = invoice.manualDiscount?.appliedAmount || 0;
                let totalServiceValueOnInvoice = 0;
                let staffServiceValueOnInvoice = 0;

                for (const item of (invoice.lineItems || [])) {
                    if (item.itemType === 'service') {
                        totalServiceValueOnInvoice += item.finalPrice;
                        if (item.staffId?.toString() === staffObjectIdString) {
                            staffServiceValueOnInvoice += item.finalPrice;
                        }
                    }
                }

                if (totalServiceValueOnInvoice > 0 && staffServiceValueOnInvoice > 0) {
                     const staffShareOfDiscount = (manualDiscountAmount * staffServiceValueOnInvoice) / totalServiceValueOnInvoice;
                     netServiceSaleForDay -= staffShareOfDiscount;
                }
            }
            correctedTotalSales += netServiceSaleForDay + (daySale.productSale || 0) + (daySale.packageSale || 0) + (daySale.giftCardSale || 0);
        }
        
        const customerCount = monthlyPerformance.reduce((s, r) => s + (r.customerCount || 0), 0);
        // This function now returns the correct, consistent value
        const totalIncentiveEarned = await calculateMonthlyIncentive(staffObjectId, tenantId, monthStart, monthEnd);
        const totalPayoutClaimed = payoutRecords.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
        const pendingPayouts = payoutRecords.filter(p => p.status === 'pending').length;

        const decryptedAppointments = todaysAppointments.map(apt => {
            let decryptedCustomerName = 'Decryption Error';
            if ((apt.customerId as any)?.name) {
                try {
                    decryptedCustomerName = decrypt((apt.customerId as any).name);
                } catch (e) {
                    console.error(`Failed to decrypt customer name for appointment ${apt._id}`);
                    decryptedCustomerName = (apt.customerId as any).name;
                }
            }
            return {
                ...apt,
                customerName: decryptedCustomerName,
                services: (apt.serviceIds as any[]).map(s => s.name).join(', '),
                time: new Date(apt.appointmentDateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
            };
        });


        const dashboardData = {
            attendance: { achievedMinutes, requiredMinutes, todayShift },
            advances: { history: advanceRecords },
            salaries: salaryRecords,
            performance: { totalSales: correctedTotalSales, customerCount },
            incentives: { totalEarned: totalIncentiveEarned },
            payouts: { totalClaimed: totalPayoutClaimed, pendingCount: pendingPayouts },
            todaysAppointments: decryptedAppointments,
            leaveRequests: recentLeaveRequests,
        };

        return NextResponse.json({ success: true, data: dashboardData });

    } catch (error: any) {
        console.error(`Error fetching dashboard data for staff ${staffObjectId}:`, error);
        return NextResponse.json({ success: false, error: 'Failed to load dashboard data.' }, { status: 500 });
    }
}
