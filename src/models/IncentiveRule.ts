import mongoose, { Schema, Document, model, models } from 'mongoose';

// Defines the structure for a rule in the database
export interface IIncentiveRule extends Document {
  type: 'daily' | 'monthly';
  target: {
    multiplier: number;
  };
  sales: {
    includeServiceSale: boolean;
    includeProductSale: boolean;
    reviewNameValue: number;
    reviewPhotoValue: number;
  };
  incentive: {
    rate: number;
    doubleRate: number; // ADDED: The missing property for TypeScript
    applyOn: 'totalSaleValue' | 'serviceSaleOnly';
  };
}

// Mongoose schema for the incentive rules
const IncentiveRuleSchema = new Schema<IIncentiveRule>({
  type: { type: String, enum: ['daily', 'monthly'], required: true, unique: true },
  target: {
    multiplier: { type: Number, required: true, default: 5 },
  },
  sales: {
    includeServiceSale: { type: Boolean, default: true },
    includeProductSale: { type: Boolean, default: true },
    reviewNameValue: { type: Number, default: 200 },
    reviewPhotoValue: { type: Number, default: 300 },
  },
  incentive: {
    rate: { type: Number, required: true, default: 0.05 },
    doubleRate: { type: Number, default: 0.10 }, // ADDED: The missing field for the database schema
    applyOn: { type: String, enum: ['totalSaleValue', 'serviceSaleOnly'], default: 'totalSaleValue' }
  },
}, { timestamps: true });

const IncentiveRule = models.IncentiveRule || model<IIncentiveRule>('IncentiveRule', IncentiveRuleSchema);

export default IncentiveRule;