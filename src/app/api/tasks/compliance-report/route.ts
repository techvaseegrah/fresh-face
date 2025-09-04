// src/app/api/tasks/compliance-report/route.ts - NEW FILE

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/staff';
import Task from '@/models/Task'; // Ensure your Task model is imported
import { getTenantIdOrBail } from '@/lib/tenant';
import { startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

export async function GET(request: NextRequest) {
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ success: false, error: 'Start date and end date are required.' }, { status: 400 });
    }

    const startDate = startOfDay(new Date(startDateParam));
    const endDate = endOfDay(new Date(endDateParam));

    // 1. Get all active staff members
    const staffMembers = await Staff.find({ tenantId, status: 'active' }).select('_id name').lean();

    // 2. Get all relevant, assigned tasks within the date range
    const tasks = await Task.find({
      tenantId,
      assignedTo: { $in: staffMembers.map(s => s._id) },
      dueDate: { $gte: startDate, $lte: endDate },
      isGroupMaster: { $ne: true },
    }).select('_id taskName assignedTo dueDate status checklistAnswers').lean();

    // 3. Build the final report data structure
    const reportData = staffMembers.map(staff => {
      const staffSubmissions: Record<string, any> = {};
      const dateArray = eachDayOfInterval({ start: startDate, end: endDate });
      
      dateArray.forEach(date => {
        const dateString = date.toISOString().split('T')[0];
        
        const tasksForDay = tasks.filter(task => 
          task.assignedTo?.toString() === staff._id.toString() &&
          new Date(task.dueDate).toISOString().split('T')[0] === dateString
        );

        if (tasksForDay.length === 0) {
          staffSubmissions[dateString] = { status: 'NoTask' };
          return;
        }

        // This logic determines the single icon to show for the entire day
        if (tasksForDay.some(t => t.status === 'Awaiting Review')) {
          staffSubmissions[dateString] = { status: 'Awaiting Review', tasks: tasksForDay };
        } else if (tasksForDay.some(t => t.status === 'Rejected')) {
          staffSubmissions[dateString] = { status: 'Rejected', tasks: tasksForDay };
        } else if (tasksForDay.every(t => t.status === 'Approved' || t.status === 'Completed')) {
          staffSubmissions[dateString] = { status: 'Approved', tasks: tasksForDay };
        } else {
          staffSubmissions[dateString] = { status: 'Pending', tasks: tasksForDay };
        }
      });

      return {
        staffId: staff._id.toString(),
        staffName: staff.name,
        submissions: staffSubmissions,
      };
    });

    return NextResponse.json({ success: true, data: reportData });
  } catch (error: any) {
    console.error('Error fetching compliance report:', error);
    return NextResponse.json({ success: false, error: 'Server error fetching report data.' }, { status: 500 });
  }
}