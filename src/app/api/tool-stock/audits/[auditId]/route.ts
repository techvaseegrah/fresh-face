import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import ToolAudit from '@/models/ToolAudit';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';

interface Params {
  params: { auditId: string };
}

// GET: Fetch a single detailed audit report
export async function GET(request: NextRequest, { params }: Params) {
    const { auditId } = params;
    if (!mongoose.Types.ObjectId.isValid(auditId)) {
        return NextResponse.json({ message: 'Invalid Audit ID' }, { status: 400 });
    }

    await dbConnect();

    const tenantIdOrBail = getTenantIdOrBail(request);
    if (tenantIdOrBail instanceof NextResponse) { return tenantIdOrBail; }
    const tenantId = tenantIdOrBail;

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    // LATER: Add permission check for 'TOOL_STOCK_VIEW'
    
    try {
        const audit = await ToolAudit.findOne({ _id: auditId, tenantId });

        if (!audit) {
            return NextResponse.json({ message: 'Audit report not found or access denied' }, { status: 404 });
        }

        return NextResponse.json(audit, { status: 200 });
    } catch (error) {
        console.error(`Error fetching audit ${auditId}:`, error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}