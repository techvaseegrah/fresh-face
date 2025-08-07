// src/models/Expense.ts

import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  type: string;
  description: string;
  amount: number;
  date: Date;
  frequency: 'Regular' | 'Once';
  paymentMethod: string;
  billUrl?: string; // <-- NEW
}

const ExpenseSchema: Schema = new Schema({
  tenantId: { 
    type: require('mongoose').Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  type: {
    type: String,
    required: [true, 'Please provide an expense type.'],
    trim: true,
  },
  description: {
    type: String,
    required: false,
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, 'Please provide the expense amount.'],
    min: [0, 'Amount cannot be negative.'],
  },
  date: {
    type: Date,
    default: Date.now,
  },
  frequency: {
    type: String,
    enum: ['Regular', 'Once'],
    required: [true, 'Please specify the expense frequency.']
  },
  paymentMethod: {
    type: String,
    required: [true, 'Please provide a payment method.'],
    trim: true,
  },
  // --- NEW FIELD ---
  billUrl: {
    type: String,
    required: false,
  },
});

export default mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);