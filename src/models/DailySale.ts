// models/DailySale.ts
import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// A snapshot of the rule active when the sale was logged.
interface IAppliedRule {
  target: { multiplier: number };
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

export interface IDailySale extends Document {
  tenantId: Types.ObjectId;
  staff: Types.ObjectId;
  date: Date;
  serviceSale: number;
  productSale: number;
  reviewsWithName: number;
  reviewsWithPhoto: number;
  customerCount: number;
  appliedRule?: IAppliedRule; // This field stores the snapshot
}

const AppliedRuleSchema = new Schema<IAppliedRule>({
  target: { multiplier: { type: Number, required: true } },
  sales: {
    includeServiceSale: { type: Boolean, required: true },
    includeProductSale: { type: Boolean, required: true },
    reviewNameValue: { type: Number, required: true },
    reviewPhotoValue: { type: Number, required: true },
  },
  incentive: {
    rate: { type: Number, required: true },
    doubleRate: { type: Number, required: true },
    applyOn: { type: String, enum: ['totalSaleValue', 'serviceSaleOnly'], required: true },
  }
}, { _id: false });


const DailySaleSchema: Schema<IDailySale> = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: Date, required: true },
  serviceSale: { type: Number, default: 0 },
  productSale: { type: Number, default: 0 },
  reviewsWithName: { type: Number, default: 0 },
  reviewsWithPhoto: { type: Number, default: 0 },
  customerCount: { type: Number, default: 0 },
  appliedRule: { type: AppliedRuleSchema, required: false }
}, { timestamps: true });

// This unique index prevents duplicate entries for the same staff on the same day.
DailySaleSchema.index({ tenantId: 1, staff: 1, date: 1 }, { unique: true });

const DailySale: Model<IDailySale> = mongoose.models.DailySale || mongoose.model<IDailySale>('DailySale', DailySaleSchema);

export default DailySale;