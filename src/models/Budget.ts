import mongoose, { Schema, Document, Model } from 'mongoose';
import BudgetItemSchema, { IBudgetItem } from './BudgetItem';

export interface IBudget extends Document {
  tenantId: string;
  month: number;
  year: number;
  fixedExpenses: IBudgetItem[];
  variableExpenses: IBudgetItem[];
}

const BudgetSchema: Schema<IBudget> = new Schema({
  tenantId: { type: String, required: true, index: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  fixedExpenses: [BudgetItemSchema], // Embeds the sub-schema
  variableExpenses: [BudgetItemSchema], // Embeds the sub-schema
}, { timestamps: true });

// This compound index ensures that a tenant can only have ONE budget per month/year.
// This is critical for data integrity.
BudgetSchema.index({ tenantId: 1, month: 1, year: 1 }, { unique: true });

// This handles the case where the model is already compiled during hot-reloads
const Budget: Model<IBudget> = mongoose.models.Budget || mongoose.model<IBudget>('Budget', BudgetSchema);

export default Budget;