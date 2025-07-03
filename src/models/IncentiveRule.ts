import mongoose, { Schema, Document, model, models } from 'mongoose';

// Defines the structure for a rule in the database
export interface IIncentiveRule extends Document {
  type: 'daily' | 'monthly'; // To distinguish between the two rule sets
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
    rate: number; // e.g., 0.05 for 5%
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
    applyOn: { type: String, enum: ['totalSaleValue', 'serviceSaleOnly'], default: 'totalSaleValue' }
  },
}, { timestamps: true });

const IncentiveRule = models.IncentiveRule || model<IIncentiveRule>('IncentiveRule', IncentiveRuleSchema);

export default IncentiveRule;