import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Invoice from '@/models/invoice';
import Expense from '@/models/Expense';
import Tenant from '@/models/Tenant';
import { getTenantIdOrBail } from '@/lib/tenant';

// File Generators
import ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// --- Helper Functions ---
const formatMonthForDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
};
const formatCurrencyForPdf = (amount: number) => `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount)}`;


export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const tenantIdOrResponse = getTenantIdOrBail(request);
    if (tenantIdOrResponse instanceof NextResponse) return tenantIdOrResponse;
    const tenantId = tenantIdOrResponse;
    
    // 1. Get query params
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const format = searchParams.get('format') || 'xlsx';

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ message: 'Both startDate and endDate are required.' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    // 2. Fetch and process the data
    const revenuePromise = Invoice.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), createdAt: { $gte: startDate, $lte: endDate }, paymentStatus: 'Paid' } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, totalRevenue: { $sum: '$grandTotal' } } }
    ]);

    const expensesPromise = Expense.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, totalExpenses: { $sum: '$amount' } } }
    ]);

    const tenantPromise = Tenant.findById(tenantId).select('name').lean();
    
    const [revenues, expenses, tenantInfo] = await Promise.all([revenuePromise, expensesPromise, tenantPromise]);

    const monthlyData: { [key: string]: any } = {};
    revenues.forEach(rev => { monthlyData[rev._id] = { ...monthlyData[rev._id], totalRevenue: rev.totalRevenue }; });
    expenses.forEach(exp => { monthlyData[exp._id] = { ...monthlyData[exp._id], totalExpenses: exp.totalExpenses }; });

    const reportData = Object.keys(monthlyData)
      .sort()
      .map(month => {
        const totalRevenue = monthlyData[month].totalRevenue || 0;
        const totalExpenses = monthlyData[month].totalExpenses || 0;
        return { month, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses };
      });
      
    const tenantName = tenantInfo?.name || "Your Salon";

    // 3. Conditional Generation
    if (format === 'pdf') {
      // --- GENERATE PDF ---
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let y = height - 50;

      page.drawText('Monthly P&L Comparison', { x: 50, y, font: boldFont, size: 18 });
      y -= 20;
      page.drawText(`${tenantName} | ${startDateParam} to ${endDateParam}`, { x: 50, y, font, size: 12 });
      y -= 30;

      const headers = ['Metric', ...reportData.map(d => formatMonthForDisplay(d.month))];
      const metrics = ['Total Revenue', 'Total Expenses', 'Net Profit / Loss'];
      const colWidth = (width - 150) / headers.length; // Adjusted width for better spacing
      
      // Draw Header
      headers.forEach((header, i) => {
          page.drawText(header, { x: 50 + i * (colWidth + 10), y, font: boldFont, size: 10 });
      });
      y -= 20;

      // Draw Body
      metrics.forEach((metric, rowIndex) => {
          if (y < 40) { page = pdfDoc.addPage(); y = height - 50; }
          page.drawText(metric, { x: 50, y, font: rowIndex === 2 ? boldFont : font, size: 10 });
          reportData.forEach((data, colIndex) => {
              let value;
              if (rowIndex === 0) value = data.totalRevenue;
              else if (rowIndex === 1) value = data.totalExpenses;
              else value = data.netProfit;
              page.drawText(formatCurrencyForPdf(value), { x: 50 + (colIndex + 1) * (colWidth + 10), y, font: rowIndex === 2 ? boldFont : font, size: 10, color: value < 0 ? rgb(0.8, 0.1, 0.1) : rgb(0,0,0) });
          });
          y -= 20;
      });
      
      const pdfBytes = await pdfDoc.save();
      const responseHeaders = new Headers({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Monthly_Comparison_${startDateParam}_to_${endDateParam}.pdf"` });
      return new NextResponse(pdfBytes, { status: 200, headers: responseHeaders });

    } else {
      // --- GENERATE EXCEL ---
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Monthly Comparison');

      // Header Row
      const headerRow = worksheet.addRow(['Metric', ...reportData.map(d => formatMonthForDisplay(d.month))]);
      headerRow.font = { bold: true, size: 12 };
      headerRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; cell.font.color = { argb: 'FFFFFFFF' }; });
      
      // Data Rows
      worksheet.addRow(['Total Revenue', ...reportData.map(d => d.totalRevenue)]);
      worksheet.addRow(['Total Expenses', ...reportData.map(d => d.totalExpenses)]);
      const profitRow = worksheet.addRow(['Net Profit / Loss', ...reportData.map(d => d.netProfit)]);
      profitRow.font = { bold: true };

      // Formatting
      worksheet.columns.forEach((column, i) => {
        if (i === 0) { column.width = 25; } 
        else {
          column.width = 20;
          column.numFmt = '"₹"#,##0.00;[Red]-"₹"#,##0.00'; // Format negative numbers in red
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const responseHeaders = new Headers({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Monthly_Comparison_${startDateParam}_to_${endDateParam}.xlsx"` });
      return new NextResponse(buffer, { status: 200, headers: responseHeaders });
    }

  } catch (error) {
    console.error('[ERROR] in /api/reports/monthly-comparison/download:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}