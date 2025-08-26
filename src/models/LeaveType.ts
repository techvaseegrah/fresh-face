import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface ILeaveType extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  name: string;
}

const LeaveTypeSchema: Schema<ILeaveType> = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Leave type name is required'],
    trim: true,
  },
}, {
  timestamps: true,
});

// Ensures a tenant cannot have duplicate leave type names
LeaveTypeSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const LeaveType: Model<ILeaveType> = models.LeaveType || mongoose.model<ILeaveType>('LeaveType', LeaveTypeSchema);

export default LeaveType;