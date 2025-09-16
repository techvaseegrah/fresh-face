// models/DailySale.ts

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Interface for the rule snapshot (Unchanged)
export interface IAppliedRule {
  daily: any;
  monthly: any;
  package: any;
  giftCard: any;
}

// ✨ --- MODIFICATION: Added the 'discount' property --- ✨
export interface IDailySale extends Document {
  tenantId: Types.ObjectId;
  staff: Types.ObjectId;
  date: Date;
  serviceSale: number;
  productSale: number;
  packageSale: number;
  giftCardSale: number;
  reviewsWithName: number;
  reviewsWithPhoto: number;
  customerCount: number;
  discount: number; // This field is now included
  appliedRule?: IAppliedRule;
  createdAt: Date; 
  updatedAt: Date; 
}

// Schema for the rule snapshot (Unchanged)
const AppliedRuleSchema = new Schema<IAppliedRule>({
  daily: { type: Schema.Types.Mixed, required: false },
  monthly: { type: Schema.Types.Mixed, required: false },
  package: { type: Schema.Types.Mixed, required: false },
  giftCard: { type: Schema.Types.Mixed, required: false },
}, { _id: false });


// ✨ --- MODIFICATION: Added the 'discount' field to the schema --- ✨
const DailySaleSchema: Schema<IDailySale> = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: Date, required: true },
  serviceSale: { type: Number, default: 0 },
  productSale: { type: Number, default: 0 },
  packageSale: { type: Number, default: 0 },
  giftCardSale: { type: Number, default: 0 },
  reviewsWithName: { type: Number, default: 0 },
  reviewsWithPhoto: { type: Number, default: 0 },
  customerCount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 }, // This field is now included in the database schema
  appliedRule: { type: AppliedRuleSchema, required: false }
}, { 
  timestamps: true 
});

DailySaleSchema.index({ tenantId: 1, staff: 1, date: 1 }, { unique: true });

const DailySale: Model<IDailySale> = mongoose.models.DailySale || mongoose.model<IDailySale>('DailySale', DailySaleSchema);

export default DailySale;