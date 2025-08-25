import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { startOfMonth, endOfMonth } from 'date-fns';

/**
 * GET: The monthly task list for the logged-in user.
 * This API is compatible with the new detailed checklist and submission models.
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;
    
    await dbConnect();

    try {
        const now = new Date();
        const startOfCurrentMonth = startOfMonth(now); 
        const endOfCurrentMonth = endOfMonth(now);

        // 1. Find all monthly SOP templates assigned to the user's role.
        const checklists = await Sop.find({
            tenantId,
            type: 'monthly',
            isActive: true,
            // --- THE FIX IS HERE ---
            // Added the missing colon after `$in`
            roles: { $in: [session.user.role.id] },
        })
        .select('title description checklistItems') // Explicitly request the needed fields
        .lean();

        if (checklists.length === 0) {
            return NextResponse.json([]);
        }

        const checklistIds = checklists.map(c => c._id);

        // 2. Find all submissions for these checklists within the current month.
        const submissions = await SopSubmission.find({
            tenantId,
            staff: session.user.id, // Good practice to scope submissions to the user
            sop: { $in: checklistIds },
            submissionDate: {
                $gte: startOfCurrentMonth,
                $lte: endOfCurrentMonth
            }
        }).lean();

        // 3. For each checklist, find its corresponding submission and attach it.
        const result = checklists.map(checklist => {
            const submission = submissions.find(sub => sub.sop.toString() === checklist._id.toString());
            return { 
                ...checklist, 
                submission: submission || null 
            };
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Error fetching monthly checklist:", error);
        return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
    }
}