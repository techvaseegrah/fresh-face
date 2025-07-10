// lib/reportGeneratorEb.ts

import ExcelJS from "exceljs";
import puppeteer from 'puppeteer';
import { EbReportData } from "./data/ebReportData"; // Use the new interface

// ===================================================================================
//  EB Excel Report Generator
// ===================================================================================
export async function createEbExcelReport(data: EbReportData[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("EB Readings Report");

  // === ADD THE NEW COLUMN DEFINITION ===
  sheet.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Start Units", key: "startUnits", width: 15 },
    { header: "End Units", key: "endUnits", width: 15 },
    { header: "Units Consumed", key: "unitsConsumed", width: 18 },
    { header: "Total Appointments", key: "appointmentCount", width: 20 }, // <-- NEW COLUMN
    { header: "Cost Per Unit (₹)", key: "costPerUnit", width: 20, style: { numFmt: '"₹"#,##0.00' } },
    { header: "Total Cost (₹)", key: "totalCost", width: 20, style: { numFmt: '"₹"#,##0.00' } },
  ];
  // =====================================

  data.forEach(item => {
    sheet.addRow({
      date: new Date(item.date).toLocaleDateString('en-CA'),
      startUnits: item.startUnits ?? 'N/A',
      endUnits: item.endUnits ?? 'N/A',
      unitsConsumed: item.unitsConsumed ?? 'N/A',
      appointmentCount: item.appointmentCount, // <-- ADD THE NEW DATA
      costPerUnit: item.costPerUnit,
      totalCost: item.totalCost,
    });
  });

  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

// ===================================================================================
//  EB PDF Report Generator
// ===================================================================================
export async function createEbPdfReport(
  data: EbReportData[],
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // === ADD THE NEW COLUMN TO THE HTML TABLE ===
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF--8">
        <title>Electricity Consumption Report</title>
        <style>
          /* ... your existing styles ... */
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
              <th class="text-right">Total Appointments</th> <!-- NEW HEADER -->
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
                <td class="text-right">${item.appointmentCount}</td> <!-- NEW DATA CELL -->
                <td class="text-right">${item.costPerUnit?.toFixed(2) ?? 'N/A'}</td>
                <td class="text-right">${item.totalCost?.toFixed(2) ?? 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
  // ==========================================

  await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' }
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
}