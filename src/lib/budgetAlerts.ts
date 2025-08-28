// FILE: /lib/budgetAlerts.ts

import mongoose from 'mongoose';
import Budget, { IBudget } from '@/models/Budget';
import Expense from '@/models/Expense';
import Setting from '@/models/Setting';
import { sendBudgetThresholdAlertEmail } from '@/lib/mail';

export async function checkBudgetThreshold(
    tenantId: string,
    expenseCategory: string,
    expenseDate: Date
): Promise<void> {
    // --- Log 1: Function Entry Point ---
    console.log(`--- [1] Running Budget Check ---`, { tenantId, expenseCategory, expenseDate: expenseDate.toISOString() });

    try {
        const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
        const month = expenseDate.getMonth() + 1;
        const year = expenseDate.getFullYear();

        // --- Log 2: Querying for the Budget Document ---
        console.log(`[2] Querying for Budget: tenantId=${tenantObjectId}, month=${month}, year=${year}`);
        const budget: IBudget | null = await Budget.findOne({ tenantId: tenantObjectId, month, year });
        
        if (!budget) {
            console.log(`[STOP] No budget found for this period. Exiting check.`);
            return;
        }
        console.log(`[2.1] Budget document found.`);

        const allCategories = [...budget.fixedExpenses, ...budget.variableExpenses];
        const budgetItem = allCategories.find(item => item.category === expenseCategory);
        
        if (!budgetItem || budgetItem.amount === 0) {
            console.log(`[STOP] No budget item found for category '${expenseCategory}' or budget is 0. Exiting check.`);
            return;
        }
        console.log(`[2.2] Budget item for '${expenseCategory}' found:`, { amount: budgetItem.amount });

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // --- Log 3: Aggregating Expenses ---
        console.log(`[3] Aggregating expenses for '${expenseCategory}' between ${startDate.toISOString()} and ${endDate.toISOString()}`);
        const result: Array<{ totalSpent: number }> = await Expense.aggregate([
            {
                $match: {
                    tenantId: tenantObjectId,
                    // --- THIS IS THE CORRECTED LINE ---
                    // The field was renamed from 'type' to 'category' in the Expense model.
                    // This is the only change made to this file.
                    category: expenseCategory,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, totalSpent: { $sum: '$amount' } } }
        ]);

        const totalSpent = result.length > 0 ? result[0].totalSpent : 0;
        console.log(`[3.1] Aggregation result:`, result);
        console.log(`[3.2] Calculated totalSpent: ${totalSpent}`);

        const usage = totalSpent / budgetItem.amount;
        const usagePercentage = Math.round(usage * 100);

        // --- Log 4: Final Calculation and Threshold Check ---
        console.log(`[4] Final Calculation:`, { totalSpent, budgetAmount: budgetItem.amount, usagePercentage });

        if (usage >= 0.8) {
            console.log(`[SUCCESS] Threshold of 80% REACHED! Usage is ${usagePercentage}%. Preparing to send alert.`);

            // --- Log 5: Fetching Recipients ---
            console.log(`[5] Fetching recipients with key 'dayEndReportRecipients' for tenant ${tenantObjectId}`);
            const alertSetting = await Setting.findOne({ tenantId: tenantObjectId, key: 'dayEndReportRecipients' });
            
            const recipients: string[] = alertSetting?.value || [];
            console.log(`[5.1] Alert setting document found:`, alertSetting);
            console.log(`[5.2] Recipients found:`, recipients);
            
            if (recipients.length === 0) {
                console.log(`[STOP] No recipients configured. Skipping email.`);
                return;
            }

            // --- Log 6: Attempting to send Email ---
            console.log(`[6] >>> ATTEMPTING TO SEND EMAIL to ${recipients.join(', ')} <<<`);
            await sendBudgetThresholdAlertEmail(recipients, {
                category: expenseCategory,
                budget: budgetItem.amount,
                spent: totalSpent,
                usagePercentage: usagePercentage
            });

        } else {
            console.log(`[INFO] Threshold of 80% not met. Current usage is ${usagePercentage}%. No alert sent.`);
        }

    } catch (error) {
        console.error("--- CRITICAL ERROR in checkBudgetThreshold ---:", error);
    }
}