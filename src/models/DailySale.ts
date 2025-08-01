// models/DailySale.ts

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * @interface IAppliedRule
 * @description Defines the structure of the rule snapshot. It captures all necessary parameters
 * for a historical calculation, ensuring that calculations for past dates are consistent
 * and independent of any future changes to the incentive rules.
 */
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

/**
 * @interface IDailySale
 * @description Represents a DailySale document in MongoDB, extending Mongoose's Document type.
 */
export interface IDailySale extends Document {
  staff: Types.ObjectId;
  date: Date;
  serviceSale: number;
  productSale: number;
  reviewsWithName: number;
  reviewsWithPhoto: number;
  customerCount: number;
  /**
   * @property {IAppliedRule} [appliedRule] - A snapshot of the daily incentive rule that was active
   * when this sale was logged. This field is optional ('?') to support older records
   * created before this field was added, ensuring backward compatibility.
   */
  appliedRule?: IAppliedRule;
}

/**
 * @constant AppliedRuleSchema
 * @description A dedicated schema for the embedded 'appliedRule' sub-document.
 * Using a separate schema enforces structure and type safety in the database.
 * The `{ _id: false }` option is important to prevent Mongoose from creating a
 * separate _id for this sub-document.
 */
const AppliedRuleSchema = new Schema<IAppliedRule>({
  target: {
    multiplier: { type: Number, required: true },
  },
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


/**
 * @constant DailySaleSchema
 * @description The main Mongoose schema for the DailySale collection.
 */
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
  /**
   * @description The 'appliedRule' field uses the sub-document schema.
   * `required: false` is crucial for a smooth deployment, as it ensures
   * backward compatibility with old records that do not have this field.
   */
  appliedRule: {
    type: AppliedRuleSchema,
    required: false,
  }
}, { 
  // Automatically add `createdAt` and `updatedAt` timestamps.
  timestamps: true 
});

/**
 * @description This compound index is the most critical part of the schema for performance and data integrity.
 * 1. Performance: It makes querying by a staff member and a date range extremely fast. This will
 *    dramatically speed up both individual incentive calculations and bulk monthly reports.
 * 2. Data Integrity: The `{ unique: true }` constraint prevents duplicate entries for the
 *    same staff member on the same day, ensuring data quality at the database level.
 */
DailySaleSchema.index({ staff: 1, date: 1 }, { unique: true });

/**
 * @description This pattern prevents Mongoose from recompiling the model on every hot-reload in
 * a serverless environment like Next.js, which avoids potential errors. It checks if the model
 * already exists before attempting to create it.
 */
const DailySale: Model<IDailySale> = mongoose.models.DailySale || mongoose.model<IDailySale>('DailySale', DailySaleSchema);

export default DailySale;