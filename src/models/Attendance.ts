// src/models/Attendance.ts

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  staffId: Types.ObjectId;
  tenantId: mongoose.Schema.Types.ObjectId;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: 'present' | 'absent' | 'late' | 'incomplete' | 'on_leave' | 'week_off';
  temporaryExits: Types.ObjectId[];
  totalWorkingMinutes: number;
  isWorkComplete: boolean;
  requiredMinutes: number;
  notes?: string;
  overtimeHours: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const AttendanceSchema: Schema<IAttendance> = new Schema(
  {
    tenantId: { 
    type: require('mongoose').Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    date: { type: Date, required: true },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'incomplete', 'on_leave', 'week_off'],
      default: 'absent',
    },
    temporaryExits: [{ type: Schema.Types.ObjectId, ref: 'TemporaryExit' }],
    totalWorkingMinutes: { type: Number, default: 0 },
    isWorkComplete: { type: Boolean, default: false },
    requiredMinutes: { type: Number, default: 540 }, // Default to 9 hours (9 * 60)
    notes: { type: String, trim: true },
    overtimeHours: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// --- PERFORMANCE OPTIMIZATION: INDEXES ---
// These are critical for fast lookups in a large collection.

// This compound index ensures a staff member can only have one attendance record per day.
// It's also vital for queries filtering by both staffId and a date range (e.g., monthly summary).
AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

// This index specifically speeds up queries that filter only by date, like the "Today's Attendance" view.
AttendanceSchema.index({ date: 1 });


const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;