// models/TemporaryExit.ts

import { Schema, model, models, Document, Types } from 'mongoose';

export interface ITemporaryExit extends Document {
  attendanceId: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  reason?: string;
  durationMinutes?: number;
  isOngoing: boolean;
}

const TemporaryExitSchema = new Schema<ITemporaryExit>({
  attendanceId: { type: Schema.Types.ObjectId, ref: 'Attendance', required: true },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  reason: { type: String, trim: true },
  durationMinutes: { type: Number, default: 0 },
  isOngoing: { type: Boolean, default: true },
}, { timestamps: true });

// Crucial fix: Check if the model already exists before defining it
// This prevents the "OverwriteModelError" and addresses "Schema hasn't been registered"
// issues that arise from multiple registrations in development or serverless environments.
const TemporaryExit = models.TemporaryExit || model<ITemporaryExit>('TemporaryExit', TemporaryExitSchema);

export default TemporaryExit;