import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import DailyReconciliation from '@/models/DailyReconciliation';
import Tenant from '@/models/Tenant';
import { getTenantIdOrBail } from '@/lib/tenant';

// Excel Generator
import ExcelJS from 'exceljs';

// PDF Generator
import { PDFDocument, rgb, StandardFonts, PageSizes, PDFPage } from 'pdf-lib';

// --- Helper Functions ---
const formatDate = (date: Date) => new Date(date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const formatCurrencyForPdf = (amount: number) => `INR ${new Intl.NumberFormat('en-IN').format(amount)}`;

/**
 * A helper function for PDF generation to draw multi-line text with wrapping.
 * It returns the new Y position after drawing the text.
 */
async function drawWrappedText(
    page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: any, size: number
): Promise<number> {
    const words = text.replace(/\n/g, ' \n ').split(' ');
    let line = '';
    let currentY = y;

    for (const word of words) {
        if (word === '\n') {
            page.drawText(line, { x, y: currentY, font, size, lineHeight: size + 2 });
            currentY -= (size + 2);
            line = '';
            continue;
        }
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth) {
            page.drawText(line, { x, y: currentY, font, size, lineHeight: size + 2 });
            currentY -= (size + 2);
            line = word;
        } else {
            line = testLine;
        }
    }
    if (line) {
        page.drawText(line, { x, y: currentY, font, size, lineHeight: size + 2 });
        currentY -= (size + 2);
    }
    return currentY;
}


export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;
    
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const format = searchParams.get('format') || 'xlsx';

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ message: 'Both startDate and endDate are required.' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(endDateParam);
    endDate.setUTCHours(23, 59, 59, 999);

    const [reports, tenantInfo] = await Promise.all([
      DailyReconciliation.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 }).lean(),
      Tenant.findById(tenantId).select('name').lean()
    ]);

    const tenantName = tenantInfo?.name || "Your Salon";

    // --- Conditional Generation based on 'format' parameter ---
    if (format === 'pdf') {
      // --- GENERATE PDF ---
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage(PageSizes.A4);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = 9;
      let y = height - 40;

      // Header
      page.drawText('Daily Reconciliation Report', { x: 40, y, font: boldFont, size: 16 });
      y -= 18;
      page.drawText(`${tenantName} | Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, { x: 40, y, font, size: 11 });
      y -= 25;

      // Table Header
      const headers = ['Date', 'Total Sales', 'Cash (System)', 'Expenses', 'Closing Cash', 'Cash Diff', 'GPay Diff', 'Card Diff'];
      const colX = [40, 110, 180, 250, 320, 390, 460, 530];
      headers.forEach((header, i) => page.drawText(header, { x: colX[i], y, font: boldFont, size: fontSize }));
      y -= 5;
      page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5 });
      y -= 15;

      // Table Body
      for (const report of reports) {
        if (y < 100) { // Add new page if content is about to overflow (increased threshold for remarks)
          page = pdfDoc.addPage(PageSizes.A4);
          y = height - 40;
        }
        const row = [
          formatDate(report.date),
          formatCurrencyForPdf(report.software.total),
          formatCurrencyForPdf(report.software.cash),
          formatCurrencyForPdf(report.cash.expenses),
          formatCurrencyForPdf(report.cash.closingCash),
          formatCurrencyForPdf(report.differences.cashDiff),
          formatCurrencyForPdf(report.differences.gpayDiff),
          formatCurrencyForPdf(report.differences.cardDiff),
        ];
        row.forEach((text, i) => page.drawText(text, { x: colX[i], y, font, size: fontSize }));
        y -= 15;

        // --- NEW: Draw Remarks Below the Row ---
        if (report.bank.bankRemarks) {
            page.drawText('Bank Remarks:', { x: 50, y, font: boldFont, size: fontSize - 1, color: rgb(0.5, 0, 0.5) });
            y = await drawWrappedText(page, report.bank.bankRemarks, 120, y, width - 160, font, fontSize - 1);
            y -= 5; // Extra space after remark
        }
        if (report.cash.cashRemarks) {
            page.drawText('Cash Remarks:', { x: 50, y, font: boldFont, size: fontSize - 1, color: rgb(0.8, 0, 0.4) });
            y = await drawWrappedText(page, report.cash.cashRemarks, 120, y, width - 160, font, fontSize - 1);
            y -= 5; // Extra space after remark
        }
      }

      const pdfBytes = await pdfDoc.save();
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Reconciliation_Report_${startDateParam}_to_${endDateParam}.pdf"`,
        },
      });

    } else {
      // --- GENERATE EXCEL (default) ---
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reconciliation Report');
      
      // --- UPDATED: Added Remarks Columns ---
      worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Service Sales', key: 'serviceSales', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Product Sales', key: 'productSales', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Cash (System)', key: 'cashSystem', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Gpay (System)', key: 'gpaySystem', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Card (System)', key: 'cardSystem', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Total Sales', key: 'totalSales', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Gpay Deposit', key: 'gpayDeposit', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Card Deposit', key: 'cardDeposit', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Cash Deposit', key: 'cashDeposit', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Cash Expenses', key: 'cashExpenses', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Closing Cash', key: 'closingCash', width: 15, style: { numFmt: '"₹"#,##0' } },
        { header: 'Gpay Diff', key: 'gpayDiff', width: 12, style: { numFmt: '"₹"#,##0' } },
        { header: 'Card Diff', key: 'cardDiff', width: 12, style: { numFmt: '"₹"#,##0' } },
        { header: 'Cash Diff', key: 'cashDiff', width: 12, style: { numFmt: '"₹"#,##0' } },
        { header: 'Bank Remarks', key: 'bankRemarks', width: 40 }, // NEW
        { header: 'Cash Remarks', key: 'cashRemarks', width: 40 }, // NEW
      ];
      
      // NEW: Enable text wrapping for remarks columns
      worksheet.getColumn('bankRemarks').alignment = { wrapText: true, vertical: 'top' };
      worksheet.getColumn('cashRemarks').alignment = { wrapText: true, vertical: 'top' };
      
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      
      reports.forEach(report => {
        worksheet.addRow({
          date: new Date(report.date).toLocaleDateString('en-CA'),
          serviceSales: report.software.serviceTotal,
          productSales: report.software.productTotal,
          cashSystem: report.software.cash,
          gpaySystem: report.software.gpay,
          cardSystem: report.software.card,
          totalSales: report.software.total,
          gpayDeposit: report.bank.gpayDeposit,
          cardDeposit: report.bank.cardDeposit,
          cashDeposit: report.cash.depositDone,
          cashExpenses: report.cash.expenses,
          closingCash: report.cash.closingCash,
          gpayDiff: report.differences.gpayDiff,
          cardDiff: report.differences.cardDiff,
          cashDiff: report.differences.cashDiff,
          bankRemarks: report.bank.bankRemarks, // NEW
          cashRemarks: report.cash.cashRemarks, // NEW
        });
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Reconciliation_Report_${startDateParam}_to_${endDateParam}.xlsx"`,
        },
      });
    }

  } catch (error) {
    console.error('[ERROR] in /api/reconciliation/download:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}