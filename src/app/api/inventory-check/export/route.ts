// FILE: src/app/api/inventory-check/export/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import InventoryCheck from '@/models/InventoryCheck';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import ExcelJS from 'exceljs';

// GET handler to generate and export inventory check history as an Excel file
export async function GET(req: NextRequest) {
  try {
    // 1. Authentication and Authorization
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !hasPermission(session.user.role.permissions, PERMISSIONS.INVENTORY_CHECKER_READ)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Data (Reusing your existing logic)
    await dbConnect();
    const history = await InventoryCheck.find({}) // Fetch all checks
      .populate('product', 'name sku unit brand subCategory')
      .populate({
        path: 'product',
        populate: [
          { path: 'brand', select: 'name' },
          { path: 'subCategory', select: 'name' }
        ]
      })
      .populate('checkedBy', 'name')
      .sort({ date: -1 });

    // 3. Create Excel Workbook using exceljs
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fresh-Face System';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('Inventory Check Report');

    // Define columns
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Product Name', key: 'productName', width: 35 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Expected Qty', key: 'expected', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Actual Qty', key: 'actual', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Discrepancy', key: 'discrepancy', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Checked By', key: 'checkedBy', width: 20 },
      { header: 'Notes', key: 'notes', width: 40 },
    ];
    
    // Style the header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }; // A nice blue

    // 4. Add data rows
    history.forEach(check => {
      worksheet.addRow({
        date: new Date(check.date),
        productName: check.product?.name || 'N/A',
        sku: check.product?.sku || 'N/A',
        brand: (check.product?.brand as any)?.name || 'N/A',
        category: (check.product?.subCategory as any)?.name || 'N/A',
        expected: check.expectedQuantity,
        actual: check.actualQuantity,
        discrepancy: check.discrepancy,
        unit: check.product?.unit || 'N/A',
        checkedBy: check.checkedBy?.name || 'N/A',
        notes: check.notes || '',
      });
    });

    // 5. Generate the file buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 6. Set headers and return the file
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    headers.set('Content-Disposition', `attachment; filename="InventoryCheckReport-${timestamp}.xlsx"`);

    return new NextResponse(buffer, { status: 200, headers });

  } catch (error: any) {
    console.error("Failed to generate Excel report:", error);
    return NextResponse.json({ success: false, message: `An internal server error occurred: ${error.message}` }, { status: 500 });
  }
}