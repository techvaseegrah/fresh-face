import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import { getTenantIdOrBail } from '@/lib/tenant';
import { startOfDay, endOfDay } from 'date-fns';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;

  await dbConnect();

  try {
    const { staffId, date, newStatus } = await request.json();

    if (!staffId || !date || !['Approved', 'Rejected'].includes(newStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid parameters provided.' }, { status: 400 });
    }

    const dayStart = startOfDay(new Date(date));
    const dayEnd = endOfDay(new Date(date));

    // Update all tasks for this staff member on this day that are awaiting review
    const result = await Task.updateMany(
      {
        tenantId,
        assignedTo: new mongoose.Types.ObjectId(staffId),
        dueDate: { $gte: dayStart, $lte: dayEnd },
        status: 'Awaiting Review', // Only act on tasks that are ready for review
      },
      {
        // --- THIS IS THE ONLY CHANGE ---
        $set: {
          status: newStatus,
          reviewedAt: new Date(), // This line was added
        },
      }
    );

    if (result.matchedCount === 0) {
      // This is not an error, it might be that the tasks were already reviewed.
      return NextResponse.json({ success: true, message: 'No tasks were pending review for that day.' });
    }

    return NextResponse.json({ success: true, message: `Tasks have been ${newStatus.toLowerCase()}.` });
  } catch (error: any) {
    console.error('Error updating task review status:', error);
    return NextResponse.json({ success: false, error: 'Server error updating task status.' }, { status: 500 });
  }
}