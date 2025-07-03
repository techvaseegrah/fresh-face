// models/Attendance.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  staffId: Types.ObjectId;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: 'present' | 'absent' | 'late' | 'incomplete' | 'on_leave';
  temporaryExits: Types.ObjectId[];
  totalWorkingMinutes: number;
  isWorkComplete: boolean;
  requiredMinutes: number; // <-- NEW: To store the day's required work minutes for historical accuracy
  notes?: string;
  overtimeHours: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const AttendanceSchema: Schema<IAttendance> = new Schema(
  {
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    date: { type: Date, required: true },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'incomplete', 'on_leave'],
      default: 'absent',
    },
    temporaryExits: [{ type: Schema.Types.ObjectId, ref: 'TemporaryExit' }],
    totalWorkingMinutes: { type: Number, default: 0 },
    isWorkComplete: { type: Boolean, default: false },
    // v-- FIELD ADDED --v
    requiredMinutes: { type: Number, default: 540 }, // Default to 9 hours (9 * 60)
    notes: { type: String, trim: true },
    overtimeHours: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;