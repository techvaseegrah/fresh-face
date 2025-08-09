import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  tenantId: mongoose.Schema.Types.ObjectId; // <-- NEW
  type: string;
  description: string;
  amount: number;
  date: Date;
  frequency: 'Regular' | 'Once';
  paymentMethod: string;
  billUrl?: string;
}

const ExpenseSchema: Schema = new Schema({
  // --- NEW ---
  // Add a required, indexed reference to the Tenant model.
  // This is the core of the multi-tenant data architecture.
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
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
  billUrl: {
    type: String,
    required: false,
  },
});

export default mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);