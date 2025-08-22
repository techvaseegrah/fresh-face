import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
// *** Import monthly date functions ***
import { startOfMonth, endOfMonth } from 'date-fns';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;
    
    await dbConnect();

    // *** Get the start and end of the current month ***
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now); 
    const endOfCurrentMonth = endOfMonth(now);

    // Find all SOP templates of type 'monthly'
    const checklists = await Sop.find({
        tenantId,
        type: 'monthly', // *** Find monthly checklists ***
        isActive: true,
        roles: { $in: [session.user.role.id] },
    }).lean();

    if (checklists.length === 0) {
        return NextResponse.json([]);
    }

    const checklistIds = checklists.map(c => c._id);

    // Find submissions for these checklists WITHIN the current month
    const submissions = await SopSubmission.find({
        tenantId,
        sop: { $in: checklistIds },
        // *** Check for a submission date within the range ***
        submissionDate: {
            $gte: startOfCurrentMonth,
            $lte: endOfCurrentMonth
        }
    }).lean();

    const result = checklists.map(checklist => {
        const hasSubmitted = submissions.some(sub => sub.sop.toString() === checklist._id.toString());
        return { ...checklist, submitted: hasSubmitted };
    });

    return NextResponse.json(result);
}