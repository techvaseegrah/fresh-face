 // src/models/MonthlyIncome.ts

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IMonthlyIncome extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  year: number;
  month: number; // 1 for January, 12 for December
  amount: number;
}

const MonthlyIncomeSchema: Schema = new Schema({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  year: {
    type: Number,
    required: true,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  amount: {
    type: Number,
    required: true,
    default: 0,
  },
}, { timestamps: true });

// Ensure a unique entry per tenant per month/year
MonthlyIncomeSchema.index({ tenantId: 1, year: 1, month: 1 }, { unique: true });

const MonthlyIncome: Model<IMonthlyIncome> = mongoose.models.MonthlyIncome || mongoose.model<IMonthlyIncome>('MonthlyIncome', MonthlyIncomeSchema);

export default MonthlyIncome;