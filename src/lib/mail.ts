// FILE: /lib/mail.ts

import nodemailer from 'nodemailer';
import { format } from 'date-fns';

// A more robust interface acknowledging that some numbers might be optional
interface DayEndReportData {
  closingDate: string | Date;
  expectedTotals: { cash?: number; card?: number; upi?: number; };
  actualTotals: { cash?: number; card?: number; upi?: number; };
  discrepancies: { cash?: number; card?: number; upi?: number; total?: number; };
  cashDenominations?: { [key: string]: number; };
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

// The main email function (No changes needed here from last time)
export async function sendClosingReportEmail(
  recipientEmails: string[],
  reportData: DayEndReportData
) {
  try {
    if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      console.log(`The provided recipient list was empty. Skipping email.`);
      return;
    }
    const emailHtml = createEmailHtml(reportData);
    const formattedDate = format(new Date(reportData.closingDate), 'MMMM dd, yyyy');
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Fresh-Face System'}" <${process.env.EMAIL_FROM}>`,
      to: recipientEmails,
      subject: `Day-End Closing Report for ${formattedDate}`,
      html: emailHtml,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Day-end report email sent successfully to: ${recipientEmails.join(', ')}`);
  } catch (error) {
    console.error("Failed to send day-end report email:", error);
  }
}

// ================================================================
// THE FIX IS IN THIS FUNCTION
// ================================================================
function createEmailHtml(report: DayEndReportData): string {
    // Use optional chaining (?.) and the OR operator (||) to provide a default value of 0
    // if any property is missing from the report data.
    const expected = {
        cash: report.expectedTotals?.cash || 0,
        card: report.expectedTotals?.card || 0,
        upi: report.expectedTotals?.upi || 0,
    };
    const actual = {
        cash: report.actualTotals?.cash || 0,
        card: report.actualTotals?.card || 0,
        upi: report.actualTotals?.upi || 0,
    };
    const discrepancies = {
        cash: report.discrepancies?.cash || 0,
        card: report.discrepancies?.card || 0,
        upi: report.discrepancies?.upi || 0,
    };
    const notes = report.notes || 'No notes were provided.';
    const cashDenominations = report.cashDenominations || {};

    const formattedDate = format(new Date(report.closingDate), 'EEEE, MMMM dd, yyyy');
    
    const renderRow = (label: string, expectedVal: number, actualVal: number, discrepancyVal: number) => {
        const discrepancyColor = discrepancyVal < 0 ? '#dc2626' : (discrepancyVal > 0 ? '#f59e0b' : '#16a34a');
        const discrepancyText = discrepancyVal < 0 ? `(Shortage)` : (discrepancyVal > 0 ? `(Overage)` : `(Match)`);
        return `<tr><td style="padding: 8px; border: 1px solid #ddd;">${label}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${expectedVal.toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${actualVal.toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: ${discrepancyColor};">₹${Math.abs(discrepancyVal).toFixed(2)} ${discrepancyText}</td></tr>`;
    };
    
    const expectedGrandTotal = expected.cash + expected.card + expected.upi;
    const actualGrandTotal = actual.cash + actual.card + actual.upi;
    const totalDiscrepancy = actualGrandTotal - expectedGrandTotal;
    const denominationDetails = Object.entries(cashDenominations).filter(([, count]) => count > 0).map(([key, count]) => `<li>₹${key.replace('d', '')}: ${count} notes/coins</li>`).join('');

    // Now we use the "safe" variables in the return statement.
    return `<div style="font-family: Arial, sans-serif; color: #333;"><h2 style="color: #111;">Day-End Closing Report: ${formattedDate}</h2><p>Here is the summary of the day-end closing report.</p><h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Totals Summary</h3><table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"><thead><tr style="background-color: #f2f2f2;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Payment Method</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Expected (System)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Actual (Counted)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Discrepancy</th></tr></thead><tbody>${renderRow('Cash', expected.cash, actual.cash, discrepancies.cash)}${renderRow('Card', expected.card, actual.card, discrepancies.card)}${renderRow('UPI', expected.upi, actual.upi, discrepancies.upi)}</tbody><tfoot style="border-top: 2px solid #333; font-weight: bold;"><tr><td style="padding: 8px; border: 1px solid #ddd;">Grand Total</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${expectedGrandTotal.toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${actualGrandTotal.toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: ${totalDiscrepancy < 0 ? '#dc2626' : (totalDiscrepancy > 0 ? '#f59e0b' : '#16a34a')};">₹${Math.abs(totalDiscrepancy).toFixed(2)} ${totalDiscrepancy < 0 ? '(Shortage)' : (totalDiscrepancy > 0 ? '(Overage)' : '(Match)')}</td></tr></tfoot></table><h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Cash Denomination Details</h3><ul>${denominationDetails || '<li>No cash denominations were entered.</li>'}</ul><h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Notes</h3><p>${notes}</p></div>`;
}

interface BudgetAlertData {
  category: string;
  budget: number;
  spent: number;
  usagePercentage: number; // e.g., 85
}

/**
 * Sends an immediate email alert when a single budget category crosses the threshold.
 * @param recipientEmails An array of email addresses to notify.
 * @param alertData The data for the specific category that triggered the alert.
 */
export async function sendBudgetThresholdAlertEmail(
  recipientEmails: string[],
  alertData: BudgetAlertData
) {
  try {
    // Safety check: Don't proceed if there are no recipients.
    if (!recipientEmails || recipientEmails.length === 0) {
      console.log("Budget Alert: Email skipped because the recipient list was empty.");
      return;
    }

    const { category, budget, spent, usagePercentage } = alertData;

    // The full HTML body of the email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #d9534f; border-bottom: 2px solid #eee; padding-bottom: 10px;">Budget Threshold Alert</h2>
          <p>This is an automated notification to inform you that spending for the category "<strong>${category}</strong>" has reached <strong>${usagePercentage}%</strong> of its monthly budget.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
              <thead style="background-color: #f7f7f7;">
                  <tr>
                      <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Metric</th>
                      <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount</th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                      <td style="padding: 10px; border: 1px solid #ddd;">Budgeted Amount</td>
                      <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${budget.toLocaleString()}</td>
                  </tr>
                  <tr>
                      <td style="padding: 10px; border: 1px solid #ddd;">Total Spent to Date</td>
                      <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${spent.toLocaleString()}</td>
                  </tr>
              </tbody>
          </table>
          <p style="margin-top: 20px;">Please review your expenses for this category to ensure you stay within budget.</p>
      </div>
    `;

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
        to: recipientEmails.join(', '),
        subject: `❗ Budget Alert: High Spending in "${category}"`,
        html: emailHtml,
    };
    
    // The 'transporter' object is already defined at the top of your file
    await transporter.sendMail(mailOptions);
    console.log(`Budget threshold alert sent successfully to: ${recipientEmails.join(', ')}`);
  } catch (error) {
    console.error("Failed to send budget threshold alert email:", error);
  }
}