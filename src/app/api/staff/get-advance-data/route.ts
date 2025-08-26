import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import AdvancePayment from '@/models/advance';
import Staff, { IStaff } from '@/models/staff'; // Import your Staff model and interface
import { getTenantIdOrBail } from '@/lib/tenant';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role.name !== 'staff') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) {
    return tenantId;
  }

  const staffId = session.user.id;

  try {
    await dbConnect();

    // Fetch the staff member from the database
    const staffMember: IStaff | null = await Staff.findById(staffId);
    if (!staffMember) {
      return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
    }
    
    // --- FIX: Use `salary` from your IStaff model ---
    const baseSalary = staffMember.salary || 0;

    // Fetch all advance history for this staff member
    const history = await AdvancePayment.find({ staffId, tenantId })
      .sort({ requestDate: -1 }) // Show newest first
      .lean();

    // Calculate total approved advances to find the remaining salary
    const totalApprovedAdvance = history
      .filter(adv => adv.status === 'approved')
      .reduce((sum, adv) => sum + adv.amount, 0);

    const remainingSalary = baseSalary - totalApprovedAdvance;
    
    // Format the history data to send to the frontend
    const formattedHistory = history.map(item => ({
        id: item._id.toString(),
        amount: item.amount,
        date: new Date(item.requestDate).toLocaleDateString('en-US'), // Format: M/D/YYYY
        status: item.status.charAt(0).toUpperCase() + item.status.slice(1), // Capitalize
    }));

    // Return the complete data structure
    return NextResponse.json({
      success: true,
      history: formattedHistory,
      salary: {
        base: baseSalary,
        remaining: remainingSalary,
      },
    }, { status: 200 });

  } catch (error) {
    console.error("Error fetching advance data:", error);
    return NextResponse.json({ success: false, error: 'Server error while fetching data.' }, { status: 500 });
  }
}