import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Tool from '@/models/Tool';
import { getTenantIdOrBail } from '@/lib/tenant';

// Import all necessary libraries at the top
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// GET: Generate and return an Excel or PDF file of all tools
export async function GET(request: NextRequest) {
    // Get the desired format from the URL (e.g., /export?format=pdf)
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
        
        const tools = await Tool.find({ tenantId }).sort({ name: 1 }).lean();
        if (tools.length === 0) {
            return NextResponse.json({ message: 'No tools to export.' }, { status: 404 });
        }
        
        const dateStringForFilename = new Date().toISOString().split('T')[0];
        const fileName = `Tool_Stock_Report_${dateStringForFilename}`;
        let fileBuffer: Buffer | ArrayBuffer;
        const headers = new Headers();

        if (format === 'xlsx') {
            const dataToExport = tools.map(tool => ({
                'Tool Name': tool.name,
                'Category': tool.category,
                'Current Stock': tool.currentStock,
                'Maintenance Due Date': tool.maintenanceDueDate ? new Date(tool.maintenanceDueDate).toLocaleDateString() : '',
                'Is Active': tool.isActive ? 'Yes' : 'No',
            }));
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Tools');
            fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            headers.set('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);

        } else { // format === 'pdf'
            const doc = new jsPDF();
            const tableColumn = ["Tool Name", "Category", "Current Stock", "Maintenance Due", "Active"];
            const tableRows = tools.map(tool => [
                tool.name,
                tool.category,
                tool.currentStock,
                tool.maintenanceDueDate ? new Date(tool.maintenanceDueDate).toLocaleDateString() : 'N/A',
                tool.isActive ? 'Yes' : 'No'
            ]);

            doc.setFontSize(18);
            doc.text("Tool Stock Report", 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, 30);

            autoTable(doc, { head: [tableColumn], body: tableRows, startY: 40 });
            
            fileBuffer = doc.output('arraybuffer');
            headers.set('Content-Type', 'application/pdf');
            headers.set('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
        }

        return new NextResponse(fileBuffer, { status: 200, headers });

    } catch (error: any) {
        console.error('Error exporting tools:', error);
        return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
    }
}