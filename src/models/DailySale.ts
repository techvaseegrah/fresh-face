// models/DailySale.ts

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// ✨ --- MODIFICATION: This interface now represents a complete snapshot of all four rules --- ✨
export interface IAppliedRule {
  daily: any;
  monthly: any;
  package: any;
  giftCard: any;
}

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
  appliedRule?: IAppliedRule; // This will now store the complete snapshot
  createdAt: Date; 
  updatedAt: Date; 
}

// ✨ --- MODIFICATION: The schema is updated to match the new snapshot structure --- ✨
const AppliedRuleSchema = new Schema<IAppliedRule>({
  daily: { type: Schema.Types.Mixed, required: false },
  monthly: { type: Schema.Types.Mixed, required: false },
  package: { type: Schema.Types.Mixed, required: false },
  giftCard: { type: Schema.Types.Mixed, required: false },
}, { _id: false });


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
  appliedRule: { type: AppliedRuleSchema, required: false }
}, { 
  timestamps: true 
});

DailySaleSchema.index({ tenantId: 1, staff: 1, date: 1 }, { unique: true });

const DailySale: Model<IDailySale> = mongoose.models.DailySale || mongoose.model<IDailySale>('DailySale', DailySaleSchema);

export default DailySale;