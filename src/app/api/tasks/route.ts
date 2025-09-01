import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { startOfDay, endOfDay } from 'date-fns';

// --- GET Function ---
export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenantId = getTenantIdOrBail(request);
  if (tenantId instanceof NextResponse) return tenantId;

  await dbConnect();
  
  try {
    const { searchParams } = new URL(request.url);
    const assignedToFilter = searchParams.get('assignedTo');
    const viewFilter = searchParams.get('view');

    // ✅ NEWLY ADDED: LOGIC FOR THE STAFF "MY TASKS" PAGE
    // This block handles requests from staff members asking for their own tasks.
    if (assignedToFilter === 'me') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'Not authenticated for this action.' }, { status: 401 });
      }
      const query = { 
        tenantId, 
        isGroupMaster: { $ne: true }, // Staff should only see their individual assignments
        assignedTo: new mongoose.Types.ObjectId(session.user.id) 
      };
      // Find all tasks assigned to the logged-in user and sort them
      const tasks = await Task.find(query)
        .populate({ path: 'assignedTo', model: Staff, select: 'name' })
        .sort({ dueDate: 1 }); // Sort by the nearest due date first
      return NextResponse.json({ success: true, data: tasks });
    }
    
    // --- EXISTING ADMIN LOGIC (UNCHANGED) ---

    // Logic for Admin View - List of all assigned tasks
    else if (viewFilter === 'compliance') {
      const query = { tenantId, isGroupMaster: { $ne: true } };
      const tasks = await Task.find(query).populate({ path: 'assignedTo', model: Staff, select: 'name' }).sort({ createdAt: -1 });
      return NextResponse.json({ success: true, data: tasks });
    }

    // Logic for the Admin's Grid-Based Compliance Report
    else if (viewFilter === 'reportGrid') {
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');
      if (!startDateParam || !endDateParam) {
        return NextResponse.json({ success: false, error: 'Start and end dates are required for report view.' }, { status: 400 });
      }
      const startDate = startOfDay(new Date(startDateParam));
      const endDate = endOfDay(new Date(endDateParam));

      const staffMembers = await Staff.find({ tenantId, status: 'active' }).select('_id name').lean();
      const staffIds = staffMembers.map(s => s._id);

      const allTasksInRange = await Task.find({
        tenantId,
        assignedTo: { $in: staffIds },
        dueDate: { $gte: startDate, $lte: endDate },
        isGroupMaster: { $ne: true },
      }).select('_id taskName assignedTo dueDate status checklistAnswers').lean();

      const reportData = {
          staff: staffMembers,
          submissions: allTasksInRange.filter(t => t.status !== 'Pending'), 
          assignedTasks: allTasksInRange.filter(t => t.status === 'Pending'),
      };

      return NextResponse.json({ success: true, data: reportData });
    }

    // Default Logic for the main Admin Task Library page (shows master/group tasks)
    else {
      const query: any = { tenantId };
      query.$or = [{ isGroupMaster: true }, { parentTaskId: { $exists: false }, isGroupMaster: { $ne: true } }];
      const tasks = await Task.find(query).populate({ path: 'assignedTo', model: Staff, select: 'name' }).sort({ createdAt: -1 });
      return NextResponse.json({ success: true, data: tasks });
    }
  } catch (error: any) {
    console.error("[TASKS_GET_ERROR]", error);
    return NextResponse.json({ success: false, error: 'Server error fetching tasks' }, { status: 500 });
  }
}

// --- POST Function (UNCHANGED) ---
// This function for creating tasks remains exactly as you provided.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await dbConnect();
    const tenantId = getTenantIdOrBail(req) as string;
    const body = await req.json();
    const { assignmentType, assignee, taskName, dueDate, createdBy, frequency, checklistQuestions } = body;

    if (assignmentType === 'Position') {
      const positionName = assignee;
      if (!positionName) return NextResponse.json({ success: false, error: 'Position is required for group tasks.' }, { status: 400 });

      const masterTask = await Task.create({
        tenantId: new mongoose.Types.ObjectId(tenantId), taskName, position: positionName, dueDate: new Date(dueDate),
        createdBy: new mongoose.Types.ObjectId(createdBy), frequency: frequency || 'None', isRecurring: frequency !== 'None',
        isGroupMaster: true, checklistQuestions: checklistQuestions || [],
      });

      const staffInPosition = await Staff.find({ tenantId, position: positionName, status: 'active' }).select('_id');
      if (staffInPosition.length > 0) {
        const childTaskPromises = staffInPosition.map(staff => Task.create({
          tenantId: new mongoose.Types.ObjectId(tenantId), taskName, assignedTo: staff._id, position: positionName,
          dueDate: new Date(dueDate), createdBy: new mongoose.Types.ObjectId(createdBy), frequency: frequency || 'None',
          isRecurring: frequency !== 'None', parentTaskId: masterTask._id,
          checklistQuestions: checklistQuestions || [],
        }));
        await Promise.all(childTaskPromises);
      }
      return NextResponse.json({ success: true, message: `Group task created for ${staffInPosition.length} staff.` }, { status: 201 });
    } else {
      const staffId = assignee;
      if (!mongoose.Types.ObjectId.isValid(staffId)) return NextResponse.json({ success: false, error: 'A valid staff member must be selected.' }, { status: 400 });
      const assignedStaff = await Staff.findById(staffId).select('position');
      if (!assignedStaff) return NextResponse.json({ success: false, error: 'Assigned staff not found.' }, { status: 404 });
      const newTask = await Task.create({
        tenantId: new mongoose.Types.ObjectId(tenantId), taskName, assignedTo: new mongoose.Types.ObjectId(staffId),
        position: assignedStaff.position, dueDate: new Date(dueDate), createdBy: new mongoose.Types.ObjectId(createdBy),
        frequency: frequency || 'None', isRecurring: frequency !== 'None', checklistQuestions: checklistQuestions || [],
      });
      return NextResponse.json({ success: true, data: newTask }, { status: 201 });
    }
  } catch (error: any) {
    console.error("[TASKS_POST_ERROR]", error);
    return NextResponse.json({ success: false, error: `Server Error: ${error.message}` }, { status: 500 });
  }
}