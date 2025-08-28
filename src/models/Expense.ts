import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  category: string;      // RENAMED from 'type'
  subCategory: string;   // NEW: For specific expense items
  description: string;
  amount: number;
  date: Date;
  frequency: 'Regular' | 'Once';
  paymentMethod: string;
  billUrl?: string;
}

const ExpenseSchema: Schema = new Schema({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  // RENAMED 'type' to 'category' to directly link with a budget category.
  category: {
    type: String,
    required: [true, 'Please provide an expense category.'],
    trim: true,
  },
  // Added a subCategory for more detailed expense descriptions.
  subCategory: {
    type: String,
    required: [true, 'Please provide a sub-category or item name.'],
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