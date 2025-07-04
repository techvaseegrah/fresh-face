// lib/reportGeneratorEb.ts

import ExcelJS from "exceljs";
import puppeteer from 'puppeteer';
import { EbReportData } from "./data/ebReportData"; // Import our new data interface

// ===================================================================================
//  EB Excel Report Generator
// ===================================================================================
export async function createEbExcelReport(data: EbReportData[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("EB Readings Report");

  // Define columns specific to the EB report
  sheet.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Start Units", key: "startUnits", width: 15 },
    { header: "End Units", key: "endUnits", width: 15 },
    { header: "Units Consumed", key: "unitsConsumed", width: 18 },
    { header: "Cost Per Unit (₹)", key: "costPerUnit", width: 20, style: { numFmt: '"₹"#,##0.00' } },
    { header: "Total Cost (₹)", key: "totalCost", width: 20, style: { numFmt: '"₹"#,##0.00' } },
  ];

  data.forEach(item => {
    sheet.addRow({
      date: new Date(item.date).toLocaleDateString('en-CA'), // Format as YYYY-MM-DD
      startUnits: item.startUnits ?? 'N/A',
      endUnits: item.endUnits ?? 'N/A',
      unitsConsumed: item.unitsConsumed ?? 'N/A',
      costPerUnit: item.costPerUnit,
      totalCost: item.totalCost,
    });
  });

  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  // If buffer is an ArrayBuffer, convert it to a Node.js Buffer
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

// ===================================================================================
//  EB PDF Report Generator (Using Puppeteer)
// ===================================================================================
export async function createEbPdfReport(
  data: EbReportData[],
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Create the HTML content for the EB report
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Electricity Consumption Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 40px; color: #333; }
          .report-header { text-align: center; margin-bottom: 30px; }
          h1 { font-size: 24px; margin-bottom: 5px; }
          p { font-size: 14px; color: #666; margin: 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #e0e0e0; padding: 10px 12px; text-align: left; }
          thead th { background-color: #f7f7f7; font-weight: 600; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>Electricity Consumption Report</h1>
          <p>For the period: ${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="text-right">Start Units</th>
              <th class="text-right">End Units</th>
              <th class="text-right">Units Consumed</th>
              <th class="text-right">Cost/Unit (₹)</th>
              <th class="text-right">Total Cost (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td>${new Date(item.date).toLocaleDateString('en-IN')}</td>
                <td class="text-right">${item.startUnits?.toFixed(2) ?? 'N/A'}</td>
                <td class="text-right">${item.endUnits?.toFixed(2) ?? 'N/A'}</td>
                <td class="text-right">${item.unitsConsumed?.toFixed(2) ?? 'N/A'}</td>
                <td class="text-right">${item.costPerUnit?.toFixed(2) ?? 'N/A'}</td>
                <td class="text-right">${item.totalCost?.toFixed(2) ?? 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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
  // Convert Uint8Array to Buffer before returning
  return Buffer.from(pdfBuffer);
}