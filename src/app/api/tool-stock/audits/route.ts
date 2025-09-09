import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import ToolAudit from '@/models/ToolAudit';
import { getTenantIdOrBail } from '@/lib/tenant';
import Tool from '@/models/Tool'; // Needed for GET

// POST: Submit a new audit
export async function POST(request: NextRequest) {
    await dbConnect();

    const tenantIdOrBail = getTenantIdOrBail(request);
    if (tenantIdOrBail instanceof NextResponse) { return tenantIdOrBail; }
    const tenantId = tenantIdOrBail;
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    // LATER: Add permission check for 'TOOL_STOCK_AUDIT'
    const auditorId = session.user.id;
    const auditorName = session.user.name || 'N/A';
    
    try {
        const body = await request.json();
        const { items } = body;

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: 'Audit items are required.' }, { status: 400 });
        }

        const newAudit = new ToolAudit({
            tenantId,
            auditorId,
            auditorName,
            items: items.map(item => ({
                ...item,
                discrepancy: item.countedStock - item.expectedStock,
                status: item.countedStock === item.expectedStock ? 'MATCHED' : 'MISMATCHED'
            }))
        });

        await newAudit.save();

        // Optional: Trigger email notification to admin here

        return NextResponse.json(newAudit, { status: 201 });

    } catch (error: any) {
        console.error('Error submitting audit:', error);
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// GET: List all past audits
export async function GET(request: NextRequest) {
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
        const audits = await ToolAudit.find({ tenantId }).sort({ createdAt: -1 });
        return NextResponse.json(audits, { status: 200 });

    } catch (error) {
        console.error('Error fetching audits:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}