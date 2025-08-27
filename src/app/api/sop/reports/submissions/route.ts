import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantIdOrBail } from '@/lib/tenant';
import dbConnect from '@/lib/dbConnect';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import User from '@/models/user';
import Sop from '@/models/Sop';
import SopSubmission from '@/models/SopSubmission';
import { startOfDay, endOfDay } from 'date-fns';

/**
 * GET: The main data source for the SOP Compliance Report.
 * Fetches all necessary data for a given tenant and date range, ensuring data integrity.
 * 1. A list of all active staff members.
 * 2. A list of all active SOPs (checklists), including their detailed checklistItems.
 * 3. A list of all submissions that belong to those active checklists within the date range.
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPermission(session.user.role?.permissions || [], PERMISSIONS.SOP_REPORTS_READ)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const tenantId = getTenantIdOrBail(req);
    if (tenantId instanceof NextResponse) return tenantId;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({ message: 'Start date and end date are required' }, { status: 400 });
    }

    await dbConnect();

    try {
        // 1. Get all active staff members for the tenant. This query is perfect.
        const staffMembers = await User.find({ tenantId, isActive: true })
            .populate('roleId', 'displayName _id')
            .select('name roleId')
            .lean();

        // 2. Get all active SOPs that are any of the checklist types for the tenant.
        const activeChecklists = await Sop.find({ 
            tenantId, 
            type: { $in: ['daily', 'weekly', 'monthly'] },
            isActive: true 
        })
        // --- THE FIX ---: Explicitly include `checklistItems` for the review modal.
        .select('_id title roles checklistItems') 
        .lean();

        // Get the IDs of ONLY the active checklists.
        const activeChecklistIds = activeChecklists.map(c => c._id);

        // --- ROBUSTNESS IMPROVEMENT ---
        // 3. Fetch only the submissions that belong to the active checklists.
        // This prevents "orphaned" submissions from appearing in the report.
        const submissions = await SopSubmission.find({
            tenantId,
            submissionDate: {
                $gte: startOfDay(new Date(startDate)),
                $lte: endOfDay(new Date(endDate)),
            },
            sop: { $in: activeChecklistIds } // Crucial filter
        }).lean();
        
        // 4. Return the clean, consistent data.
        return NextResponse.json({ staff: staffMembers, checklists: activeChecklists, submissions });

    } catch (error: any) {
        console.error("Error generating SOP report:", error);
        return NextResponse.json({ message: 'Server Error', error: error.message }, { status: 500 });
    }
}