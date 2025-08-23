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

    // 1. Find all daily SOP templates assigned to the user's role.
    // This query is already correct and includes the necessary checklistItems.
    const checklists = await Sop.find({
        tenantId,
        type: 'daily',
        isActive: true,
        roles: { $in: [session.user.role.id] },
    })
    .select('title description checklistItems') // Explicitly request the needed fields
    .lean();

    if (checklists.length === 0) {
        return NextResponse.json([]);
    }

    const checklistIds = checklists.map(c => c._id);

    // 2. Find all submissions for these checklists specifically for today.
    // We now fetch the full submission object to get the status.
    const submissions = await SopSubmission.find({
        tenantId,
        staff: session.user.id, // It's good practice to scope submissions to the user
        submissionDate: today,
        sop: { $in: checklistIds }
    }).lean();

    // --- THIS IS THE UPGRADED LOGIC ---
    // 3. For each checklist, find its corresponding submission and attach it.
    const result = checklists.map(checklist => {
        // Find the submission object that matches this checklist's ID.
        const submission = submissions.find(sub => sub.sop.toString() === checklist._id.toString());
        
        // Return the checklist data along with the full submission object (or null if not found).
        return { 
            ...checklist, 
            submission: submission || null 
        };
    });
    // --- END OF UPGRADED LOGIC ---

    return NextResponse.json(result);
}