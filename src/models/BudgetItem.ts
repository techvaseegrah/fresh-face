import mongoose, { Schema, Document } from 'mongoose';

// Interface representing a document in MongoDB.
export interface IBudgetItem extends Document {
  category: string;
  amount: number;
  type: 'Fixed' | 'Variable';
}

// Schema corresponding to the document interface.
const BudgetItemSchema: Schema<IBudgetItem> = new Schema({
  category: {
    type: String,
    required: [true, 'Budget category is required.'], // Strict validation
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, 'Budget amount is required.'],
    min: [0, 'Amount cannot be negative.'], // Ensure amount is not negative
  },
  type: {
    type: String,
    enum: ['Fixed', 'Variable'],
    required: [true, 'Budget type (Fixed/Variable) is required.'],
  },
});

export default BudgetItemSchema;