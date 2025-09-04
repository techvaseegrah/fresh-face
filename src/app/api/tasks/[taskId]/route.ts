import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import Staff from '@/models/staff';
import { getTenantIdOrBail } from '@/lib/tenant';

/**
 * GET a single task by its ID.
 * Used to fetch full task details for view/edit modals.
 */
export async function GET(
  req: NextRequest, { params }: { params: { taskId: string } }
): Promise<NextResponse> {
  try {
    await connectDB();
    const { taskId } = params;
    const tenantId = getTenantIdOrBail(req) as string;

    const task = await Task.findOne({ _id: taskId, tenantId })
      .populate({ path: 'assignedTo', model: Staff, select: 'name' });

    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found.' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    console.error(`[TASK_GET_SINGLE_ERROR]`, error);
    return NextResponse.json({ success: false, error: 'Server error fetching task details.' }, { status: 500 });
  }
}

/**
 * PATCH (Update) a task. Used for editing details or submitting checklist answers.
 */
export async function PATCH(
  req: NextRequest, { params }: { params: { taskId: string } }
): Promise<NextResponse> {
  try {
    await connectDB();
    const { taskId } = params;
    const tenantId = getTenantIdOrBail(req) as string;
    const body = await req.json();

    // THIS IS THE KEY LOGIC FOR STAFF SUBMISSIONS.
    // When a staff member submits their checklist, the body will contain 'checklistAnswers'.
    // This `if` block correctly changes the status to 'Awaiting Review' for the admin.
    if (body.checklistAnswers) {
      body.status = 'Awaiting Review';
    }

    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId, tenantId },
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return NextResponse.json({ success: false, error: 'Task not found or update failed.' }, { status: 404 });
    }
    
    // If a master task's core details are updated, update all its children
    if (updatedTask.isGroupMaster && (body.taskName || body.dueDate || body.checklistQuestions)) {
      const fieldsToUpdate: any = {};
      if (body.taskName) fieldsToUpdate.taskName = body.taskName;
      if (body.dueDate) fieldsToUpdate.dueDate = body.dueDate;
      if (body.checklistQuestions) fieldsToUpdate.checklistQuestions = body.checklistQuestions;
      
      await Task.updateMany(
        { parentTaskId: taskId, tenantId }, 
        { $set: fieldsToUpdate }
      );
    }

    return NextResponse.json({ success: true, data: updatedTask });
  } catch (error: any) {
    console.error('[TASK_PATCH_ERROR]', error);
    if (error.name === 'ValidationError') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Server error updating task.' }, { status: 500 });
  }
}

/**
 * DELETE a task (and its children if it's a group master).
 */
export async function DELETE(
  req: NextRequest, { params }: { params: { taskId: string } }
): Promise<NextResponse> {
  try {
    await connectDB();
    const { taskId } = params;
    const tenantId = getTenantIdOrBail(req) as string;
    const taskToDelete = await Task.findOne({ _id: taskId, tenantId });
    if (!taskToDelete) return NextResponse.json({ success: false, error: 'Task not found.' }, { status: 404 });
    
    // If it's a master task, delete all its children as well
    if (taskToDelete.isGroupMaster) {
      await Task.deleteMany({ parentTaskId: taskId, tenantId });
    }

    await Task.deleteOne({ _id: taskId, tenantId });
    return NextResponse.json({ success: true, message: 'Task deleted successfully.' });
  } catch (error: any) {
    console.error(`[TASK_DELETE_ERROR]`, error);
    return NextResponse.json({ success: false, error: 'Server error deleting task.' }, { status: 500 });
  }
}