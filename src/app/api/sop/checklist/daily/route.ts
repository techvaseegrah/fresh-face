import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { startOfDay } from 'date-fns';

/**
 * GET: The daily task list for the logged-in user.
 * This API is compatible with the new detailed checklist and submission models.
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.SOP_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;
    
    await dbConnect();

    try {
        const today = startOfDay(new Date());

        // 1. Find all daily SOP templates assigned to the user's role.
        // This query correctly fetches the new, complex `checklistItems` array because the model has been updated.
        const checklists = await Sop.find({
            tenantId,
            type: 'daily',
            isActive: true,
            roles: { $in: [session.user.role.id] },
        })
        .select('title description checklistItems') // Explicitly requesting the detailed items.
        .lean();

        if (checklists.length === 0) {
            return NextResponse.json([]);
        }

        const checklistIds = checklists.map(c => c._id);

        // 2. Find all submissions for these checklists for today.
        // This will return the submission with its new, complex `responses` array.
        const submissions = await SopSubmission.find({
            tenantId,
            staff: session.user.id,
            submissionDate: today,
            sop: { $in: checklistIds }
        }).lean();

        // 3. Map the results. This logic correctly attaches the entire submission object to its
        //    corresponding SOP, giving the frontend all the data it needs.
        const result = checklists.map(checklist => {
            const submission = submissions.find(sub => sub.sop.toString() === checklist._id.toString());
            return { 
                ...checklist, 
                submission: submission || null 
            };
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Error fetching daily checklist:", error);
        return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
    }
}