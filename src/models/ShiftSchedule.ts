import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Interface for the full document in MongoDB
export interface IShiftSchedule extends Document {
  staffId: Types.ObjectId; // Link to the Staff model
  date: Date;
  shiftTime: string;
}

const ShiftScheduleSchema: Schema = new Schema({
  staffId: {
    type: Schema.Types.ObjectId,
    ref: 'Staff', // This links to your existing Staff model
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  shiftTime: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
}, { timestamps: true });

// This prevents assigning two different shifts to the same person on the same day.
ShiftScheduleSchema.index({ staffId: 1, date: 1 }, { unique: true });

const ShiftSchedule: Model<IShiftSchedule> =
  mongoose.models.ShiftSchedule || mongoose.model<IShiftSchedule>('ShiftSchedule', ShiftScheduleSchema);

export default ShiftSchedule;