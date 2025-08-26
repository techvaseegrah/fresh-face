import mongoose, { Schema, Document, models, Model } from 'mongoose';

// Interface for TypeScript type checking
export interface ILeaveRequest extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  staff: mongoose.Schema.Types.ObjectId; // CORRECT: This should be 'staff' and it's a reference ID
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

const LeaveRequestSchema: Schema<ILeaveRequest> = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  // --- THIS IS THE CORRECTED FIELD ---
  // It expects an ObjectId and refers to the 'Staff' model.
  // The error shows your file currently has 'staffName' here instead.
  staff: {
    type: Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Staff member is required'], // Mongoose requires a staff ID
  },
  leaveType: {
    type: String,
    required: [true, 'Leave type is required'],
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
}, {
  timestamps: true,
});

const LeaveRequest: Model<ILeaveRequest> = models.LeaveRequest || mongoose.model<ILeaveRequest>('LeaveRequest', LeaveRequestSchema);

export default LeaveRequest;