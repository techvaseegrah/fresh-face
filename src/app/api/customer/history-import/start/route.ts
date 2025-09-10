// src/app/api/customer/history-import/start/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getTenantIdOrBail } from '@/lib/tenant';
import formidable, { File } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import ImportJob, { IImportJob } from '@/models/ImportJob';
import { processHistoryImport } from '@/lib/customerHistoryImporter';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role.permissions, PERMISSIONS.CUSTOMERS_IMPORT)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;
    
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob | null;
        if (!file) {
            return NextResponse.json({ message: 'File not found in form data.' }, { status: 400 });
        }

        const tempDir = path.join(process.cwd(), 'tmp');
        await fs.mkdir(tempDir, { recursive: true });
        
        // Convert Blob to buffer and write to a temporary file
        const buffer = Buffer.from(await file.arrayBuffer());
        const tempFilePath = path.join(tempDir, `upload_${Date.now()}_${file.name}`);
        await fs.writeFile(tempFilePath, buffer);

        await connectToDatabase();
        
        const job: IImportJob = await ImportJob.create({
            tenantId,
            startedBy: new mongoose.Types.ObjectId(session.user.id),
            jobType: 'customerHistory',
            status: 'pending',
            originalFilename: file.name || 'unknown.xlsx',
        });

        // Start background processing with the path to our manually created temp file
        processHistoryImport(tempFilePath, job._id.toString());

        return NextResponse.json({ success: true, jobId: job._id.toString() });

    } catch (error: any) {
        console.error('Error in file upload route:', error);
        return NextResponse.json({ message: "Internal server error.", error: error.message }, { status: 500 });
    }
}