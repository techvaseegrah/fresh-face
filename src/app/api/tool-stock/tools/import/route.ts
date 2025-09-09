import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Tool from '@/models/Tool';
import ToolLog from '@/models/ToolLog';
import { getTenantIdOrBail } from '@/lib/tenant';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';

// This helper function parses the uploaded file from the request
async function parseFormData(req: NextRequest): Promise<Buffer | null> {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
        return null;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return buffer;
}

// POST: Handle Excel file upload for importing tools
export async function POST(request: NextRequest) {
    await dbConnect();

    const tenantIdOrBail = getTenantIdOrBail(request);
    if (tenantIdOrBail instanceof NextResponse) { return tenantIdOrBail; }
    const tenantId = tenantIdOrBail;
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
        const buffer = await parseFormData(request);
        if (!buffer) {
            return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 });
        }

        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return NextResponse.json({ message: 'The uploaded file is empty.' }, { status: 400 });
        }

        let createdCount = 0;
        let updatedCount = 0;
        const errors: { row: number; error: string }[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Excel rows are 1-based, plus header

            const toolName = row['Tool Name']?.toString().trim();
            if (!toolName) {
                errors.push({ row: rowNum, error: 'Tool Name is missing.' });
                continue;
            }

            // We do not update existing tools via this import to prevent accidental data changes.
            // This import is primarily for adding new tools.
            const existingTool = await Tool.findOne({ name: toolName, tenantId }).session(dbSession);
            if (existingTool) {
                errors.push({ row: rowNum, error: `A tool named '${toolName}' already exists.` });
                continue; // Skip to the next row
            }

            const openingStockValue = row['Opening Stock'];
            if (openingStockValue === undefined || openingStockValue === null) {
                errors.push({ row: rowNum, error: 'Opening Stock is missing.' });
                continue;
            }
            const openingStock = Number(openingStockValue);
            if (isNaN(openingStock) || openingStock < 0) {
                errors.push({ row: rowNum, error: 'Opening Stock must be a valid non-negative number.' });
                continue;
            }

            // Create the new tool
            const newTool = new Tool({
                tenantId,
                name: toolName,
                category: row['Category']?.toString().trim() || 'General',
                openingStock: openingStock,
                currentStock: openingStock,
                maintenanceDueDate: row['Maintenance Due Date'] ? new Date(row['Maintenance Due Date']) : undefined,
            });
            await newTool.save({ session: dbSession });

            // Create the initial log entry
            const toolLog = new ToolLog({
                tenantId,
                toolId: newTool._id,
                userId,
                action: 'OPENING_STOCK',
                quantityChange: openingStock,
                stockBefore: 0,
                stockAfter: openingStock,
                remarks: 'Imported from Excel file',
            });
            await toolLog.save({ session: dbSession });
            createdCount++;
        }

        if (errors.length > 0) {
            // If there are any validation errors, abort the entire transaction
            throw new Error('Validation errors found in the file. No tools were imported.');
        }

        await dbSession.commitTransaction();

        return NextResponse.json({
            message: 'Import successful.',
            created: createdCount,
            updated: 0, // We are not updating existing tools
            errors: [],
        }, { status: 200 });

    } catch (error: any) {
        await dbSession.abortTransaction();
        // This catch block handles transaction aborts, returning validation errors to the user
        // Extract errors from the catch block if they were thrown
        const finalErrors = error.message.includes('Validation errors') ? (error.cause || []) : [];
        return NextResponse.json({
            message: error.message || 'Import failed. No changes were made.',
            created: 0,
            updated: 0,
            errors: finalErrors,
        }, { status: 400 });
    } finally {
        dbSession.endSession();
    }
}