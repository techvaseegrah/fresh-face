import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

// 1. Define an interface for the document's properties
export interface IIncentivePayout extends Document {
  staff: Types.ObjectId;
  tenantId: Types.ObjectId;
  amount: number;
  payoutDate: Date;
  notes?: string; // Optional field
  createdAt: Date; // Automatically added by timestamps
  updatedAt: Date; // Automatically added by timestamps
}

// 2. Create the Mongoose Schema, using the interface for type safety
const IncentivePayoutSchema: Schema<IIncentivePayout> = new Schema({
  staff: {
    type: Schema.Types.ObjectId,
    ref: 'Staff', // This links to your 'Staff' model
    required: [true, 'Staff ID is required.'],
    index: true, // Add index for faster queries on staff
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Tenant ID is required.'],
    index: true, // Add index for faster queries on tenant
  },
  amount: {
    type: Number,
    required: [true, 'Payout amount is required.'],
    min: [0.01, 'Payout amount must be greater than zero.'],
  },
  payoutDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  notes: {
    type: String,
    trim: true,
  },
}, {
  // 3. Add timestamps for createdAt and updatedAt fields
  timestamps: true 
});

// 4. Export the model, preventing recompilation in hot-reloading environments
// The model is typed with the IIncentivePayout interface
const IncentivePayout = models.IncentivePayout || model<IIncentivePayout>('IncentivePayout', IncentivePayoutSchema);

export default IncentivePayout;