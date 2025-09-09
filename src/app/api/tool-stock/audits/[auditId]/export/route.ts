import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import ToolAudit from '@/models/ToolAudit';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';

// --- START: THE CRITICAL FIX FOR PDF GENERATION ---
// Import the jsPDF class directly, not as a default
import { jsPDF } from 'jspdf';
// Import the autoTable function directly
import autoTable from 'jspdf-autotable';
// --- END: THE CRITICAL FIX ---

interface Params {
  params: { auditId: string };
}

export async function GET(request: NextRequest, { params }: Params) {
    const { auditId } = params;
    if (!mongoose.Types.ObjectId.isValid(auditId)) {
        return NextResponse.json({ message: 'Invalid Audit ID' }, { status: 400 });
    }
    
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    if (format !== 'xlsx' && format !== 'pdf') {
        return NextResponse.json({ message: 'Invalid format specified. Use "xlsx" or "pdf".' }, { status: 400 });
    }
    
    await dbConnect();
    const tenantIdOrBail = getTenantIdOrBail(request);
    if (tenantIdOrBail instanceof NextResponse) { return tenantIdOrBail; }
    const tenantId = tenantIdOrBail;

    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const report = await ToolAudit.findOne({ _id: auditId, tenantId }).lean();
        if (!report) {
            return NextResponse.json({ message: 'Audit report not found.' }, { status: 404 });
        }

        const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
        const reportDate = new Date(report.createdAt);
        // Format the date into YYYY-MM-DD format
        const dateStringForFilename = reportDate.toISOString().split('T')[0]; // e.g., "2025-09-09"
        // Create the new user-friendly filename
        const fileName = `Audit_Report_${dateStringForFilename}`;
        // --- END: FILENAME CHANGE ---
        let fileBuffer: Buffer | ArrayBuffer;
        const headers = new Headers();

        if (format === 'xlsx') {
            // Excel logic is correct and remains the same
            const dataToExport = report.items.map(item => ({'Tool Name': item.toolName,'Expected Stock': item.expectedStock,'Counted Stock': item.countedStock,'Discrepancy': item.discrepancy,'Status': item.status,'Remarks': item.remarks || '',}));
            const worksheet = XLSX.utils.json_to_sheet([]);
            XLSX.utils.sheet_add_aoa(worksheet, [[`Audit Report`],[`Date: ${formatDate(report.createdAt.toISOString())}`],[`Auditor: ${report.auditorName}`],[],['Tool Name', 'Expected Stock', 'Counted Stock', 'Discrepancy', 'Status', 'Remarks'],], { origin: 'A1' });
            XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: -1, skipHeader: true });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Details');
            fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            headers.set('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
        } else { // format === 'pdf'
            // --- UPDATED PDF LOGIC ---
            // Use 'new jsPDF()' instead of just jsPDF()
            const doc = new jsPDF();
            const tableColumn = ["Tool Name", "Expected", "Counted", "Discrepancy", "Remarks"];
            const tableRows = report.items.map(item => [item.toolName, item.expectedStock, item.countedStock, item.discrepancy, item.remarks || 'N/A']);

            doc.setFontSize(18); doc.text("Audit Report", 14, 22);
            doc.setFontSize(11); doc.setTextColor(100);
            doc.text(`Date: ${formatDate(report.createdAt.toISOString())}`, 14, 30);
            doc.text(`Auditor: ${report.auditorName}`, 14, 36);

            // Call autoTable as a function, passing the doc instance to it
            autoTable(doc, { head: [tableColumn], body: tableRows, startY: 50 });
            
            fileBuffer = doc.output('arraybuffer');
            headers.set('Content-Type', 'application/pdf');
            headers.set('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
        }

        return new NextResponse(fileBuffer, { status: 200, headers });

    } catch (error: any) {
        console.error('Error exporting audit report:', error);
        // Log the specific error for better debugging
        return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
    }
}