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

// NOTE: The code logic is the same, only the file path has changed.
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
        // 1. Get all active staff members for the tenant
        const staffMembers = await User.find({ tenantId, isActive: true }).populate('roleId', 'displayName').select('name roleId').lean();

        // 2. Get all active checklist-type SOPs for the tenant
        const checklists = await Sop.find({ tenantId, type: 'checklist', isActive: true }).select('title roles').lean();

        // 3. Get all submissions within the selected date range
        // --- THIS IS THE FIX ---
        // The .select() method has been removed from this query.
        const submissions = await SopSubmission.find({
            tenantId,
            submissionDate: {
                $gte: startOfDay(new Date(startDate)),
                $lte: endOfDay(new Date(endDate)),
            }
        }).lean();
        
        // 4. Return the raw data, which now includes the full submission object.
        return NextResponse.json({ staff: staffMembers, checklists, submissions });

    } catch (error) {
        console.error("Error generating SOP report:", error);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
}