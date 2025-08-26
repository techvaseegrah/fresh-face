import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IDailyExpense extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  amount: number;
  description: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyExpenseSchema: Schema<IDailyExpense> = new Schema(
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

DailyExpenseSchema.index({ tenantId: 1, createdAt: -1 });

const DailyExpense: Model<IDailyExpense> =
  models.DailyExpense || mongoose.model<IDailyExpense>('DailyExpense', DailyExpenseSchema);

export default DailyExpense;