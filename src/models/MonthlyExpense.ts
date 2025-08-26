import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IMonthlyExpense extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  amount: number;
  description: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyExpenseSchema: Schema<IMonthlyExpense> = new Schema(
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
    category: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

MonthlyExpenseSchema.index({ tenantId: 1, createdAt: -1 });

const MonthlyExpense: Model<IMonthlyExpense> =
  models.MonthlyExpense || mongoose.model<IMonthlyExpense>('MonthlyExpense', MonthlyExpenseSchema);

export default MonthlyExpense;