// app/api/attendance/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Attendance, { IAttendance } from '../../../models/Attendance';
import Staff, { IStaff } from '../../../models/staff';
import TemporaryExit, { ITemporaryExit } from '../../../models/TemporaryExit';
import mongoose, { Types } from 'mongoose';
import { differenceInMinutes, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

// --- GET Handler (No changes needed) ---
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');

  try {
    await dbConnect();
    
    if (action === 'getToday') {
      const todayDate = new Date();
      const todayStartBoundary = startOfDay(todayDate);
      const todayEndBoundary = endOfDay(todayDate);

      const records = await Attendance.find({
        date: { $gte: todayStartBoundary, $lte: todayEndBoundary },
      })
        .populate<{ staffId: Pick<IStaff, '_id' | 'name' | 'image' | 'position'> | null }>({ path: 'staffId', model: Staff, select: 'name image position' })
        .populate<{ temporaryExits: ITemporaryExit[] }>({ path: 'temporaryExits', model: TemporaryExit })
        .sort({ checkIn: 'asc' })
        .lean();

      const validRecords = records.filter(record => record.staffId);
      
      return NextResponse.json({ success: true, data: validRecords });
    }
    
    else if (action === 'getMonthly') {
      const yearStr = searchParams.get('year');
      const monthStr = searchParams.get('month');

      if (!yearStr || !monthStr) {
        return NextResponse.json({ success: false, error: 'Year and month parameters are required for monthly view' }, { status: 400 });
      }
      const parsedYear = parseInt(yearStr);
      const parsedMonth = parseInt(monthStr);

      if (isNaN(parsedYear) || isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        return NextResponse.json({ success: false, error: 'Invalid year or month parameters' }, { status: 400 });
      }
      
      const startDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1));
      const endDate = endOfMonth(startDate);

      const records = await Attendance.find({ date: { $gte: startDate, $lte: endDate } })
        .populate<{ staffId: Pick<IStaff, '_id' | 'name' | 'image' | 'position'> | null }>({ path: 'staffId', model: Staff, select: 'name image position' })
        .populate<{ temporaryExits: ITemporaryExit[] }>({ path: 'temporaryExits', model: TemporaryExit })
        .sort({ date: 'asc', checkIn: 'asc' })
        .lean();
      
      const validRecords = records.filter(record => record.staffId);
      
      return NextResponse.json({ success: true, data: validRecords });
    }

    return NextResponse.json({ success: false, error: 'Invalid or missing GET action specified' }, { status: 400 });

  } catch (error: any) {
    console.error(`API GET /api/attendance (action: ${action}) Error:`, error);
    return NextResponse.json({ success: false, error: `Server error: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

// --- POST Handler (Corrected) ---
export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');

  try {
    await dbConnect();
    
    if (action === 'checkIn') {
        const body = await request.json();
        // FIX: Destructure requiredHours from the request body
        const { staffId, requiredHours } = body;

        if (!staffId || !isValidObjectId(staffId)) {
            return NextResponse.json({ success: false, error: 'Invalid or missing staff ID' }, { status: 400 });
        }
        // FIX: Add validation for the requiredHours
        if (typeof requiredHours !== 'number' || requiredHours <= 0) {
            return NextResponse.json({ success: false, error: 'Invalid or missing requiredHours' }, { status: 400 });
        }

        const todayStartBoundary = startOfDay(new Date());
        const todayEndBoundary = endOfDay(new Date());

        const existingRecord = await Attendance.findOne({
            staffId: new Types.ObjectId(staffId),
            date: { $gte: todayStartBoundary, $lte: todayEndBoundary },
        });

        if (existingRecord) {
            if (existingRecord.checkIn) {
                return NextResponse.json({ success: false, error: 'Attendance already recorded and checked-in for today' }, { status: 400 });
            }
            existingRecord.checkIn = new Date();
            // FIX: Set status to incomplete, not present
            existingRecord.status = 'incomplete';
            // FIX: Set required minutes when updating an existing (but not checked-in) record
            existingRecord.requiredMinutes = requiredHours * 60;
            const updatedRecord = await existingRecord.save();
            const populatedUpdatedRecord = await Attendance.findById(updatedRecord._id).populate('staffId', 'name image position').populate('temporaryExits').lean();
            return NextResponse.json({ success: true, data: populatedUpdatedRecord });
        }
        
        const now = new Date();
        // FIX: Create the new record with the correct requiredMinutes and initial status
        const newAttendance = new Attendance({
            staffId: new Types.ObjectId(staffId),
            date: now,
            checkIn: now,
            status: 'incomplete', // Status is 'incomplete' until work is done
            requiredMinutes: requiredHours * 60, // Save the required hours in minutes
        });

        const savedRecord = await newAttendance.save();
        const populatedRecord = await Attendance.findById(savedRecord._id).populate('staffId', 'name image position').populate('temporaryExits').lean();
        return NextResponse.json({ success: true, data: populatedRecord }, { status: 201 });
    } 
    
    else if (action === 'checkOut') {
      const attendanceIdParam = searchParams.get('attendanceId');
      if (!attendanceIdParam || !isValidObjectId(attendanceIdParam)) { return NextResponse.json({ success: false, error: 'Invalid or missing attendanceId for checkOut' }, { status: 400 }); }
      
      const attendance = await Attendance.findById(attendanceIdParam).populate('temporaryExits');
      if (!attendance) return NextResponse.json({ success: false, error: 'Attendance record not found' }, { status: 404 });
      if (attendance.checkOut) return NextResponse.json({ success: false, error: 'Already checked out' }, { status: 400 });
      if (!attendance.checkIn) return NextResponse.json({ success: false, error: 'Cannot check-out without a check-in record' }, { status: 400 });
      
      // Use the requiredMinutes from the record itself (saved during check-in)
      const standardWorkMinutes = attendance.requiredMinutes || (9 * 60); // Fallback to 9 hours if not present
      
      const populatedExits = attendance.temporaryExits as unknown as ITemporaryExit[];
      if (populatedExits.some(exit => !exit.endTime)) { return NextResponse.json({ success: false, error: 'An exit is still ongoing. End it before checking out.' }, { status: 400 }); }
      
      const checkOutTime = new Date();
      const totalMinutes = differenceInMinutes(checkOutTime, attendance.checkIn);
      const temporaryExitMinutes = populatedExits.reduce((total, exit) => total + (exit.durationMinutes || 0), 0);
      const finalWorkingMinutes = Math.max(0, totalMinutes - temporaryExitMinutes);
      const overtimeMinutes = Math.max(0, finalWorkingMinutes - standardWorkMinutes);
      
      attendance.checkOut = checkOutTime;
      attendance.totalWorkingMinutes = finalWorkingMinutes;
      attendance.requiredMinutes = standardWorkMinutes;
      attendance.isWorkComplete = finalWorkingMinutes >= standardWorkMinutes;
      attendance.status = attendance.isWorkComplete ? 'present' : 'incomplete';
      attendance.overtimeHours = overtimeMinutes / 60;
      
      await attendance.save();
      const populatedResponseRecord = await Attendance.findById(attendance._id).populate('staffId', 'name image position').populate('temporaryExits').lean();
      return NextResponse.json({ success: true, data: populatedResponseRecord });
    }
    
    else if (action === 'startTempExit') {
        const body = await request.json();
        const attendanceIdParam = searchParams.get('attendanceId');
        if (!attendanceIdParam || !isValidObjectId(attendanceIdParam)) { return NextResponse.json({ success: false, error: 'Invalid or missing attendanceId for startTempExit' }, { status: 400 }); }
        const { reason } = body; 
        if (!reason || typeof reason !== 'string' || reason.trim() === '') { return NextResponse.json({ success: false, error: 'A valid reason is required.' }, { status: 400 }); }
        const currentAttendance = await Attendance.findById(attendanceIdParam).populate('temporaryExits');
        if (!currentAttendance) return NextResponse.json({ success: false, error: 'Attendance record not found' }, { status: 404 });
        if (currentAttendance.checkOut) return NextResponse.json({ success: false, error: 'Cannot start temp exit after check-out' }, { status: 400 });
        if (!currentAttendance.checkIn) return NextResponse.json({ success: false, error: 'Cannot start temp exit before check-in' }, { status: 400 });
        if ((currentAttendance.temporaryExits as unknown as ITemporaryExit[]).some(exit => !exit.endTime)) { return NextResponse.json({ success: false, error: 'An exit is already ongoing.' }, { status: 400 }); }
        const newTempExit = new TemporaryExit({ attendanceId: currentAttendance._id, startTime: new Date(), reason: reason.trim(), });
        const savedTempExit = await newTempExit.save();
        await Attendance.updateOne({ _id: currentAttendance._id }, { $push: { temporaryExits: savedTempExit._id }});
        return NextResponse.json({ success: true, data: savedTempExit.toObject() });
    }
    
    return NextResponse.json({ success: false, error: 'Invalid action for POST request' }, { status: 400 });

  } catch (error: any) {
    console.error(`API POST /api/attendance (action: ${action}) Error:`, error);
    return NextResponse.json({ success: false, error: `Server error: ${error.message || 'Unknown error'}` }, { status: 500 });
   }
}

// --- PUT Handler (No changes needed) ---
export async function PUT(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');
    const tempExitId = searchParams.get('tempExitId');

    if (action === 'endTempExit') {
        if (!tempExitId || !isValidObjectId(tempExitId)) { return NextResponse.json({ success: false, error: "Valid tempExitId is required" }, { status: 400 }); }
        try {
            await dbConnect();
            const existingExit = await TemporaryExit.findById(tempExitId);
            if (!existingExit) return NextResponse.json({ success: false, error: "Temporary exit not found"}, { status: 404 });
            if (existingExit.endTime) return NextResponse.json({ success: false, error: "Temporary exit already ended"}, { status: 400 });
            const endTime = new Date();
            const duration = differenceInMinutes(endTime, existingExit.startTime);
            existingExit.endTime = endTime;
            existingExit.durationMinutes = Math.max(0, duration); 
            const updatedExit = await existingExit.save();
            return NextResponse.json({ success: true, data: updatedExit.toObject() });
        } catch (error: any) {
            console.error(`API PUT /api/attendance (action: ${action}, tempExitId: ${tempExitId}) Error:`, error);
            if (error.name === 'ValidationError') return NextResponse.json({ success: false, error: error.message }, { status: 400 });
            return NextResponse.json({ success: false, error: `Server error: ${error.message || 'Unknown error'}` }, { status: 500 });
        }
    }
    return NextResponse.json({ success: false, error: "Invalid action for PUT request" }, { status: 400 });
}