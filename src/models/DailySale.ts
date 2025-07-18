import mongoose, { Document, Schema, Model } from 'mongoose';

// This interface describes the structure of the rule snapshot we will save.
// It matches the structure of IIncentiveRule.
interface IAppliedRule {
  target: {
    baseAmount: number;
    multiplierForDouble: number;
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
}

// ✨ FIX: Add `appliedRule` to your existing IDailySale interface.
export interface IDailySale extends Document {
  staff: mongoose.Types.ObjectId;
  date: Date;
  serviceSale: number;
  productSale: number;
  reviewsWithName: number;
  reviewsWithPhoto: number;
  customerCount: number;
  appliedRule?: IAppliedRule; // The '?' makes it optional for old records that don't have it.
}

// Define the schema for the sub-document.
const AppliedRuleSchema = new Schema<IAppliedRule>({
  target: {
    baseAmount: { type: Number, required: true },
    multiplierForDouble: { type: Number, required: true },
  },
  sales: { /* ... schema definition ... */ },
  incentive: { /* ... schema definition ... */ }
}, { _id: false });


// Your original DailySaleSchema, with one new field added.
const DailySaleSchema: Schema<IDailySale> = new Schema({
  staff: {
    type: Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  serviceSale: { type: Number, default: 0 },
  productSale: { type: Number, default: 0 },
  reviewsWithName: { type: Number, default: 0 },
  reviewsWithPhoto: { type: Number, default: 0 },
  customerCount: { type: Number, default: 0 },
  // ✨ FIX: Add the field to the schema so it saves to the database.
  appliedRule: {
    type: AppliedRuleSchema,
    required: false,
  }
}, { timestamps: true });

DailySaleSchema.index({ staff: 1, date: 1 }, { unique: true });

const DailySale: Model<IDailySale> = mongoose.models.DailySale || mongoose.model<IDailySale>('DailySale', DailySaleSchema);

export default DailySale;