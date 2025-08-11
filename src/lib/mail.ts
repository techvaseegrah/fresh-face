// FILE: /lib/mail.ts

import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import connectToDatabase from '@/lib/mongodb';
import Setting from '@/models/Setting';
import DayEndReport from '@/models/DayEndReport'; // 👈 IMPORT the actual model for strong typing

// This interface can be removed if DayEndReport model's type is used directly.
// We'll keep it for the createEmailHtml function for now.
interface DayEndReportData {
  closingDate: Date; // Use Date object for consistency
  expectedTotals: { cash: number; card: number; upi: number; };
  actualTotals: { cash: number; card: number; upi: number; };
  discrepancies: { cash: number; card: number; upi: number; total: number; };
  cashDenominations: { [key: string]: number; };
  notes: string;
}

// Create the transporter (No changes here)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
    auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
    },
});

// --- 👇 CORRECTED TENANT-AWARE FUNCTION 👇 ---
export async function sendClosingReportEmail(
    reportDocument: InstanceType<typeof DayEndReport>, // 👈 CHANGED: Accept the full Mongoose document for type safety
    tenantId: string                                   // 👈 CHANGED: Accept the tenantId
) {
    try {
        await connectToDatabase();
        const settingKey = 'dayEndReportRecipients';

        // ❗ CRITICAL: The query now includes `tenantId` to get the correct recipients.
        const settingDoc = await Setting.findOne({ key: settingKey, tenantId: tenantId }).lean();

        const recipientEmails = settingDoc?.value;
        if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
            console.log(`No recipients configured for '${settingKey}' for tenant ${tenantId}. Skipping email.`);
            return; // Exit gracefully, this is not an error.
        }

        // The HTML function now receives the Mongoose document directly.
        const emailHtml = createEmailHtml(reportDocument); 
        
        const formattedDate = format(reportDocument.closingDate, 'MMMM dd, yyyy');

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Fresh-Face System'}" <${process.env.EMAIL_FROM}>`,
            to: recipientEmails,
            subject: `Day-End Closing Report for ${formattedDate}`,
            html: emailHtml,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Day-end report email sent successfully for tenant ${tenantId} to: ${recipientEmails.join(', ')}`);

    } catch (error) {
        // ❗ CHANGED: Do not throw an error. The report is already saved.
        // Crashing here would give a false error to the user. Just log it.
        console.error(`Failed to send day-end report email for tenant ${tenantId}:`, error);
    }
}

// --- The HTML creation function (Minor type adjustment) ---
function createEmailHtml(report: DayEndReportData): string {
    const { closingDate, expectedTotals, actualTotals, discrepancies, notes, cashDenominations } = report;
    const formattedDate = format(closingDate, 'EEEE, MMMM dd, yyyy'); // Use the Date object directly

    // The rest of this function's logic remains exactly the same...
    const renderRow = (label: string, expected: number, actual: number, discrepancy: number) => {
        const discrepancyColor = discrepancy < 0 ? '#dc2626' : (discrepancy > 0 ? '#f59e0b' : '#16a34a');
        const discrepancyText = discrepancy < 0 ? `(Shortage)` : (discrepancy > 0 ? `(Overage)` : `(Match)`);
        return `<tr><td style="padding: 8px; border: 1px solid #ddd;">${label}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${expected.toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${actual.toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: ${discrepancyColor};">₹${Math.abs(discrepancy).toFixed(2)} ${discrepancyText}</td></tr>`;
    };
    const expectedGrandTotal = expectedTotals.cash + expectedTotals.card + expectedTotals.upi;
    const actualGrandTotal = actualTotals.cash + actualTotals.card + actualTotals.upi;
    const totalDiscrepancy = actualGrandTotal - expectedGrandTotal;
    const denominationDetails = Object.entries(cashDenominations).filter(([, count]) => count > 0).map(([key, count]) => `<li>₹${key.replace('d', '')}: ${count} notes/coins</li>`).join('');
    return `<div style="font-family: Arial, sans-serif; color: #333;"><h2 style="color: #111;">Day-End Closing Report: ${formattedDate}</h2><p>Here is the summary of the day-end closing report.</p><h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Totals Summary</h3><table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"><thead><tr style="background-color: #f2f2f2;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Payment Method</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Expected (System)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Actual (Counted)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Discrepancy</th></tr></thead><tbody>${renderRow('Cash', expectedTotals.cash, actualTotals.cash, discrepancies.cash)}${renderRow('Card', expectedTotals.card, actualTotals.card, discrepancies.card)}${renderRow('UPI', expectedTotals.upi, actualTotals.upi, discrepancies.upi)}</tbody><tfoot style="border-top: 2px solid #333; font-weight: bold;"><tr><td style="padding: 8px; border: 1px solid #ddd;">Grand Total</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${expectedGrandTotal.toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${actualGrandTotal.toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: ${totalDiscrepancy < 0 ? '#dc2626' : (totalDiscrepancy > 0 ? '#f59e0b' : '#16a34a')};">₹${Math.abs(totalDiscrepancy).toFixed(2)} ${totalDiscrepancy < 0 ? '(Shortage)' : (totalDiscrepancy > 0 ? '(Overage)' : '(Match)')}</td></tr></tfoot></table><h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Cash Denomination Details</h3><ul>${denominationDetails || '<li>No cash denominations were entered.</li>'}</ul><h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Notes</h3><p>${notes || 'No notes were provided.'}</p></div>`;
}