// FILE: /lib/budget-threshold.ts

import Budget, { IBudget } from '@/models/Budget';
import Expense from '@/models/Expense';
import User from '@/models/user';
import Setting from '@/models/Setting';
import { sendBudgetAlertEmail } from './mail';

export async function checkBudgetThreshold(
    tenantId: string,
    expenseCategory: string,
    expenseDate: Date
): Promise<void> {
    // --- START DEBUG LOGGING ---
    console.log(`\n--- [BUDGET CHECK TRIGGERED] ---`);
    console.log(`- Category: ${expenseCategory}`);
    console.log(`- Tenant ID: ${tenantId}`);
    // --- END DEBUG LOGGING ---

    try {
        const month = expenseDate.getMonth() + 1;
        const year = expenseDate.getFullYear();

        const budget: IBudget | null = await Budget.findOne({ tenantId, month, year });
        if (!budget) {
            console.log("[DEBUG] Result: No budget found for this period. Exiting.");
            return;
        }

        const allCategories = [...budget.fixedExpenses, ...budget.variableExpenses];
        const budgetItem = allCategories.find(item => item.category === expenseCategory);

        if (!budgetItem || budgetItem.amount === 0) {
            console.log(`[DEBUG] Result: Category '${expenseCategory}' is not in the budget or budget is 0. Exiting.`);
            return;
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const result: Array<{ totalSpent: number }> = await Expense.aggregate([
            // ... (aggregation pipeline)
        ]);

        const totalSpent = result.length > 0 ? result[0].totalSpent : 0;
        const usage = totalSpent / budgetItem.amount;
        const percentage = Math.round(usage * 100);

        console.log(`[DEBUG] Calculation: Spent ₹${totalSpent} of ₹${budgetItem.amount}. Usage is ${percentage}%.`);

        if (usage >= 0.8) {
            console.log(`[DEBUG] Condition MET: Usage is >= 80%. Proceeding to send email.`);

            // 1. Find primary user email
            const user = await User.findOne({ tenantId: tenantId });
            const primaryEmail = user?.email;
            console.log(`[DEBUG] Primary Email: ${primaryEmail || 'Not Found'}`);

            // 2. Find additional recipients
            const dayEndSetting = await Setting.findOne({ tenantId, key: 'dayEndReportRecipients' });
            const additionalRecipients = (dayEndSetting?.value as string[] | undefined) || [];
            console.log(`[DEBUG] Additional Emails from Settings: [${additionalRecipients.join(', ')}]`);

            // 3. Combine and de-duplicate
            const allEmails = primaryEmail ? [primaryEmail, ...additionalRecipients] : [...additionalRecipients];
            const uniqueRecipients = [...new Set(allEmails)];

            if (uniqueRecipients.length === 0) {
                console.error("[DEBUG] CRITICAL: No recipients found after combining lists. Cannot send email.");
                return;
            }

            console.log(`[DEBUG] Final Recipient List: [${uniqueRecipients.join(', ')}]`);
            
            // 4. Send the email
            const monthName = expenseDate.toLocaleString('default', { month: 'long' });
            await sendBudgetAlertEmail(uniqueRecipients, {
                category: expenseCategory,
                totalSpent,
                budgetAmount: budgetItem.amount,
                percentage,
                monthName,
                year
            });

        } else {
            console.log(`[DEBUG] Condition NOT MET: Usage is ${percentage}%, which is less than 80%. No email will be sent.`);
        }

    } catch (error) {
        console.error("--- [BUDGET CHECK FAILED] ---", error);
    }
}