import mongoose, { Schema, Document, Types, models, model } from 'mongoose';

export interface IShift extends Document {
  employeeId: Types.ObjectId;
  date: Date;
  isWeekOff: boolean;
  shiftTiming: string;
}

const ShiftSchema: Schema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  isWeekOff: {
    type: Boolean,
    default: false,
  },
  shiftTiming: {
    type: String,
    trim: true,
    default: '',
  },
}, { timestamps: true });

// This index is crucial for the upsert logic to prevent duplicate shifts for an employee on a given day.
ShiftSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// OPTIMIZATION 4: Add an index on the date field to speed up range queries (fetching a week of shifts).
ShiftSchema.index({ date: 1 });

const Shift = models.Shift || model<IShift>('Shift', ShiftSchema);

export default Shift;