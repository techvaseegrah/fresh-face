import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IDailySale extends Document {
  staff: mongoose.Types.ObjectId;
  date: Date;
  serviceSale: number;
  productSale: number;
  reviewsWithName: number;
  reviewsWithPhoto: number;
  customerCount: number; // ✨ NEW: Field for number of customers
}

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
  serviceSale: {
    type: Number,
    default: 0,
  },
  productSale: {
    type: Number,
    default: 0,
  },
  reviewsWithName: {
    type: Number,
    default: 0,
  },
  reviewsWithPhoto: {
    type: Number,
    default: 0,
  },
  // ✨ NEW: Add the customer count field to the schema
  customerCount: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

// To prevent duplicate entries for the same staff on the same day
DailySaleSchema.index({ staff: 1, date: 1 }, { unique: true });

const DailySale: Model<IDailySale> = mongoose.models.DailySale || mongoose.model<IDailySale>('DailySale', DailySaleSchema);

export default DailySale;