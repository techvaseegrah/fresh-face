import mongoose, { Schema, Document, models, Model } from 'mongoose';

// Define the different types of expenses
export type ExpenseType = 'monthly' | 'weekly' | 'daily' | 'other';

export interface IExpense extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  amount: number;
  description: string;
  expenseType: ExpenseType;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema: Schema<IExpense> = new Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    // This field will store whether it's 'monthly', 'weekly', etc.
    expenseType: {
      type: String,
      enum: ['monthly', 'weekly', 'daily', 'other'],
      required: true,
    },
    category: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

ExpenseSchema.index({ tenantId: 1, expenseType: 1, createdAt: -1 });

const Expense: Model<IExpense> =
  models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);

export default Expense;