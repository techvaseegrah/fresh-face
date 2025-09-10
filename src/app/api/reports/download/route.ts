// /api/reports/download/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchSoldReportData, fetchRedemptionReportData } from '@/lib/reportService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper for Excel (unchanged)
function generateExcel(data: any[], sheetName: string): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

async function generatePdfWithJsPDF(data: any[], title: string, reportType: 'sold' | 'redemption'): Promise<Buffer> {
    const doc = new jsPDF({
        orientation: 'landscape',
    });
    
    let head: string[][] = [];
    let dataKeys: string[] = [];

    if (reportType === 'sold') {
        head = [['Invoice #', 'Purchase Date', 'Expiry Date', 'Card Name', 'Card Number', 'Guest Name', 'Guest Number', 'Staff', 'Amount']];
        dataKeys = ['invoiceNumber', 'purchaseDate', 'expiryDate', 'giftCardName', 'giftCardNumber', 'guestName', 'guestNumber', 'staff', 'amount'];
    } else { // redemption
        head = [['Date', 'Card Name', 'Card Number', 'Guest Name', 'Guest Number', 'Amount Redeemed', 'Balance After', 'Remark']];
        dataKeys = ['date', 'giftCardName', 'giftCardNumber', 'guestName', 'guestNumber', 'amountRedeemed', 'balanceAfter', 'remark'];
    }

    // --- START: NEW ROBUST FIX ---
    const body = data.map(row => dataKeys.map(key => {
        const value = row[key];

        // Check if we are processing a monetary column
        if (key === 'amount' || key === 'amountRedeemed' || key === 'balanceAfter') {
            
            // Log the value and its type to your server console for debugging
            console.log(`PDF-GEN-DEBUG >> Key: "${key}", Value: "${value}", Type: "${typeof value}"`);

            // Forcefully convert the value to a number. This handles both numbers and string-numbers.
            const num = Number(value);

            // Check if the conversion was successful (i.e., it's not Not-a-Number)
            if (!isNaN(num)) {
                // Use toFixed(2) which is guaranteed to not have thousands separators
                return `INR ${num.toFixed(2)}`;
            }
        }

        // For all other values, or if the number conversion failed, convert to a string safely
        return String(value ?? 'N/A');
    }));
    // --- END: NEW ROBUST FIX ---
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);

    autoTable(doc, {
        startY: 30,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, },
        headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold', },
        alternateRowStyles: { fillColor: [250, 250, 250], },
    });

    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
}


export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) { return new NextResponse('Unauthorized', { status: 401 }); }
        const tenantId = session.user.tenantId;

        const { searchParams } = new URL(req.url);
        const reportType = searchParams.get('reportType');
        const format = searchParams.get('format');
        const fromDateStr = searchParams.get('from');
        const toDateStr = searchParams.get('to');

        if (!reportType || !format || !fromDateStr || !toDateStr) { return new NextResponse('Missing required parameters', { status: 400 }); }

        const fromDate = new Date(fromDateStr);
        const toDate = new Date(toDateStr);
        toDate.setHours(23, 59, 59, 999);

        let data;
        let reportTitle: string;
        let fileName: string;

        if (reportType === 'sold') {
            data = await fetchSoldReportData(tenantId, fromDate, toDate);
            reportTitle = 'Gift Card Sold Report';
        } else if (reportType === 'redemption') {
            data = await fetchRedemptionReportData(tenantId, fromDate, toDate);
            reportTitle = 'Gift Card Redemption Report';
        } else {
            return new NextResponse('Invalid report type', { status: 400 });
        }
        
        if (!data || data.length === 0) { return new NextResponse('No data found for the selected period to generate a report.', { status: 404 }); }
        
        fileName = `${reportTitle.toLowerCase().replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}`;

        let fileBuffer: Buffer;
        let contentType: string;

        if (format === 'xlsx') {
            fileBuffer = generateExcel(data, reportTitle);
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileName += '.xlsx';
        } else if (format === 'pdf') {
            fileBuffer = await generatePdfWithJsPDF(data, reportTitle, reportType as 'sold' | 'redemption');
            contentType = 'application/pdf';
            fileName += '.pdf';
        } else {
            return new NextResponse('Invalid format type', { status: 400 });
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: { 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="${fileName}"`, },
        });

    } catch (error) {
        console.error(`Error generating report:`, error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}