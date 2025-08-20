import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { startOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;
    
    await dbConnect();
    const today = startOfDay(new Date());

    const checklists = await Sop.find({
        tenantId,
        type: 'checklist',
        isActive: true,
        roles: { $in: [session.user.role.id] },
    }).lean();

    if (checklists.length === 0) return NextResponse.json([]);

    const checklistIds = checklists.map(c => c._id);
    const submissions = await SopSubmission.find({
        tenantId,
        staff: session.user.id,
        submissionDate: today,
        sop: { $in: checklistIds }
    }).lean();

    const result = checklists.map(checklist => {
        const hasSubmitted = submissions.some(sub => sub.sop.toString() === checklist._id.toString());
        return { ...checklist, submitted: hasSubmitted };
    });

    return NextResponse.json(result);
}