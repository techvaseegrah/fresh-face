import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import Sop from '@/models/Sop';
import SopSubmission from '@/models/SopSubmission';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
// --- ADDED ---: startOfDay
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions, PERMISSIONS.SOP_SUBMIT_CHECKLIST)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    // --- CHANGED ---: Added 'daily' to the list of valid types
    if (type !== 'daily' && type !== 'weekly' && type !== 'monthly') {
        return NextResponse.json({ message: 'Invalid type parameter provided.' }, { status: 400 });
    }

    await dbConnect();

    try {
        const now = new Date();
        let dateRange;

        // --- CHANGED ---: Added a new case for 'daily'
        if (type === 'daily') {
            const today = startOfDay(now);
            // For daily, we check for a specific date, not a range
            dateRange = today; 
        } else if (type === 'weekly') {
            dateRange = {
                $gte: startOfWeek(now),
                $lte: endOfWeek(now)
            };
        } else { // type === 'monthly'
            dateRange = {
                $gte: startOfMonth(now),
                $lte: endOfMonth(now)
            };
        }

        // 1. Find all checklists of the given type assigned to the user's role
        const assignedChecklists = await Sop.find({
            tenantId,
            type: type,
            isActive: true,
            roles: { $in: [session.user.role.id] },
        }).select('_id').lean();

        if (assignedChecklists.length === 0) {
            return NextResponse.json({ pendingCount: 0 });
        }
        const assignedChecklistIds = assignedChecklists.map(c => c._id);

        // 2. Find all submissions for those checklists within the date range
        // --- CHANGED ---: The query now correctly handles both a single date and a date range
        const submissions = await SopSubmission.find({
            tenantId,
            sop: { $in: assignedChecklistIds },
            submissionDate: dateRange
        }).select('sop').lean();
        
        // 3. Calculate the difference (this logic remains the same and works perfectly)
        const submittedSopIds = new Set(submissions.map(sub => sub.sop.toString()));
        const pendingCount = assignedChecklists.filter(c => !submittedSopIds.has(c._id.toString())).length;

        // 4. Return just the count
        return NextResponse.json({ pendingCount });

    } catch (error) {
        console.error("Error fetching pending count:", error);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
}