import mongoose, { Schema, Document, model, models } from 'mongoose';

// Defines the structure for a versioned rule. Versioning is now handled by createdAt.
export interface IIncentiveRule extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
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
    doubleRate: number;
    applyOn: 'totalSaleValue' | 'serviceSaleOnly';
  };
  createdAt: Date; // Mongoose adds this automatically with timestamps: true
}

const IncentiveRuleSchema = new Schema<IIncentiveRule>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  type: { type: String, enum: ['daily', 'monthly'], required: true },
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
    doubleRate: { type: Number, default: 0.10 },
    applyOn: { type: String, enum: ['totalSaleValue', 'serviceSaleOnly'], default: 'totalSaleValue' }
  },
}, { 
  // This is the key: It automatically adds `createdAt` and `updatedAt` with full timestamps.
  timestamps: true 
});

// New index on `createdAt` for finding the latest version very quickly.
IncentiveRuleSchema.index({ tenantId: 1, type: 1, createdAt: -1 });

const IncentiveRule = models.IncentiveRule || model<IIncentiveRule>('IncentiveRule', IncentiveRuleSchema);

export default IncentiveRule;