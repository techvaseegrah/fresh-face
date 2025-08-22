import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IIncentivePayout extends Document {
  staff: Types.ObjectId;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  processedDate?: Date;
  tenantId: Types.ObjectId; // ✅ THIS IS THE KEY FIELD
  createdAt: Date;
  updatedAt: Date;
}

const IncentivePayoutSchema: Schema<IIncentivePayout> = new Schema(
  {
    staff: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    processedDate: {
      type: Date,
    },
    // This field ensures every single payout record is securely linked
    // to a specific tenant in the database. All our API route logic
    // depends on this field being here.
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  },
  { timestamps: true }
);

const IncentivePayout: Model<IIncentivePayout> =
  mongoose.models.IncentivePayout || mongoose.model<IIncentivePayout>('IncentivePayout', IncentivePayoutSchema);

export default IncentivePayout;