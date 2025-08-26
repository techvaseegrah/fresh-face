import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IWeeklyExpense extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  amount: number;
  description: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WeeklyExpenseSchema: Schema<IWeeklyExpense> = new Schema(
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

WeeklyExpenseSchema.index({ tenantId: 1, createdAt: -1 });

const WeeklyExpense: Model<IWeeklyExpense> =
  models.WeeklyExpense || mongoose.model<IWeeklyExpense>('WeeklyExpense', WeeklyExpenseSchema);

export default WeeklyExpense;