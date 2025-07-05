// lib/reportGenerator.ts

import ExcelJS from "exceljs"
import puppeteer from 'puppeteer';
import { ReportStylistData } from "./data/reportData"

// ===================================================================================
//  Helper Function for Duration Formatting
// ===================================================================================

/**
 * Converts total minutes into a human-readable "X hr Y min" format.
 * @param {number} totalMinutes - The total duration in minutes.
 * @returns {string} The formatted duration string.
 */
function formatDuration(totalMinutes: number | null | undefined): string {
  if (!totalMinutes || totalMinutes <= 0) {
    return '0 hr 0 min';
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60; // The remainder is the minutes
  return `${hours} hr ${minutes} min`;
}


// ===================================================================================
//  Excel Report Generator (Updated)
// ===================================================================================
export async function createExcelReport(data: ReportStylistData[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Stylist Performance")

  sheet.columns = [
    { header: "Stylist Name", key: "stylistName", width: 30 },
    { header: "Total Appointments", key: "totalAppointments", width: 20 },
    { header: "Total Revenue (₹)", key: "totalRevenue", width: 20, style: { numFmt: "₹ #,##0.00" } },
    // --- CHANGE: Update the header for the new format ---
    { header: "Total Time Worked", key: "billedTime", width: 20 },
  ]

  data.forEach(item => {
    sheet.addRow({
      stylistName: item.stylistName || 'N/A',
      totalAppointments: item.totalAppointments || 0,
      totalRevenue: item.totalRevenue || 0,
      // --- CHANGE: Use the new helper function for formatting ---
      billedTime: formatDuration(item.totalDuration),
    })
  })

  sheet.getRow(1).font = { bold: true }
  
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}


// ===================================================================================
//  PDF Report Generator (Updated)
// ===================================================================================
export async function createPdfReport(
  data: ReportStylistData[],
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Stylist Performance Report</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          .report-container {
            width: 100%;
            max-width: 800px;
            margin: auto;
          }
          .report-header {
            text-align: center;
            margin-bottom: 30px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 5px;
          }
          p {
            font-size: 14px;
            color: #666;
            margin: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #e0e0e0;
            padding: 10px 12px;
            text-align: left;
          }
          thead th {
            background-color: #f7f7f7;
            font-weight: 600;
          }
          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }
          .text-right {
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="report-header">
            <h1>Stylist Performance Report</h1>
            <p>For the period: ${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Stylist Name</th>
                <th class="text-right">Total Appointments</th>
                <th class="text-right">Total Revenue (₹)</th>
                <!-- --- CHANGE: Update the header for the new format --- -->
                <th class="text-right">Total Time Worked</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(item => `
                <tr>
                  <td>${item.stylistName || 'N/A'}</td>
                  <td class="text-right">${item.totalAppointments || 0}</td>
                  <td class="text-right">₹${(item.totalRevenue || 0).toFixed(2)}</td>
                  <!-- --- CHANGE: Use the new helper function for formatting --- -->
                  <td class="text-right">${formatDuration(item.totalDuration)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;

  await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' }
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
}