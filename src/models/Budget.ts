import mongoose, { Schema, Document, Model } from 'mongoose';
import BudgetItemSchema, { IBudgetItem } from './BudgetItem';

// The interface is updated to use the correct Mongoose type for ObjectId.
export interface IBudget extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  month: number;
  year: number;
  fixedExpenses: IBudgetItem[];
  variableExpenses: IBudgetItem[];
}

const BudgetSchema: Schema<IBudget> = new Schema({
  // --- THIS IS THE CORRECTED DEFINITION ---
  // The type is now ObjectId and it references the 'Tenant' model for consistency.
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  fixedExpenses: [BudgetItemSchema],
  variableExpenses: [BudgetItemSchema],
}, { timestamps: true });

// This compound index ensures that a tenant can only have ONE budget per month/year.
BudgetSchema.index({ tenantId: 1, month: 1, year: 1 }, { unique: true });

// This handles the case where the model is already compiled during hot-reloads
const Budget: Model<IBudget> = mongoose.models.Budget || mongoose.model<IBudget>('Budget', BudgetSchema);

export default Budget;