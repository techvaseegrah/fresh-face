// models/IncentiveRule.ts

import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface IIncentiveRule extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  // ✨ --- ADDITION: Add 'package' and 'giftCard' to the rule types --- ✨
  type: 'daily' | 'monthly' | 'package' | 'giftCard'; 
  target: {
    // Multiplier is for Daily/Monthly
    multiplier?: number; 
    // ✨ --- ADDITION: targetValue is for Package/GiftCard --- ✨
    targetValue?: number;
  };
  sales: {
    includeServiceSale: boolean;
    includeProductSale: boolean;
    includePackageSale: boolean;
    includeGiftCardSale: boolean;
    reviewNameValue: number;
    reviewPhotoValue: number;
  };
  incentive: {
    rate: number;
    doubleRate: number;
    applyOn: 'totalSaleValue' | 'serviceSaleOnly';
    packageRate: number;
    giftCardRate: number;
  };
  createdAt: Date;
}

const IncentiveRuleSchema = new Schema<IIncentiveRule>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  // ✨ --- ADDITION: Update the enum to include new types --- ✨
  type: { type: String, enum: ['daily', 'monthly', 'package', 'giftCard'], required: true }, 
  target: {
    // Allow both fields to exist, but only one will be used depending on the rule type
    multiplier: { type: Number, required: false },
    targetValue: { type: Number, required: false },
  },
  sales: {
    includeServiceSale: { type: Boolean, default: true },
    includeProductSale: { type: Boolean, default: true },
    includePackageSale: { type: Boolean, default: false },
    includeGiftCardSale: { type: Boolean, default: false },
    reviewNameValue: { type: Number, default: 200 },
    reviewPhotoValue: { type: Number, default: 300 },
  },
  incentive: {
    rate: { type: Number, required: true, default: 0.05 },
    doubleRate: { type: Number, default: 0.10 },
    applyOn: { type: String, enum: ['totalSaleValue', 'serviceSaleOnly'], default: 'totalSaleValue' },
    packageRate: { type: Number, default: 0.02 },
    giftCardRate: { type: Number, default: 0.01 }
  },
}, {
  timestamps: true
});

IncentiveRuleSchema.index({ tenantId: 1, type: 1, createdAt: -1 });

const IncentiveRule = models.IncentiveRule || model<IIncentiveRule>('IncentiveRule', IncentiveRuleSchema);

export default IncentiveRule;