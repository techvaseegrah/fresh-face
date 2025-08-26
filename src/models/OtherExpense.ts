import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IOtherExpense extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  amount: number;
  description: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OtherExpenseSchema: Schema<IOtherExpense> = new Schema(
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

OtherExpenseSchema.index({ tenantId: 1, createdAt: -1 });

const OtherExpense: Model<IOtherExpense> =
  models.OtherExpense || mongoose.model<IOtherExpense>('OtherExpense', OtherExpenseSchema);

export default OtherExpense;