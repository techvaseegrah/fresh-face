// lib/models/ShopSetting.ts

import mongoose, { Document, Model, Schema } from 'mongoose';

// --- UPDATED INTERFACE ---
export interface IShopSetting extends Document {
  key: string; // A unique key to ensure we only have one settings document
  defaultDailyHours: number;
  defaultOtRate: number;
  defaultExtraDayRate: number;
  // --- NEW FIELDS ---
  loyaltyPointPerPrice: number;
  loyaltyPointsAwarded: number;
}

const ShopSettingSchema: Schema<IShopSetting> = new Schema({
  // We use this static key to always find the single settings document for the shop.
  key: {
    type: String,
    unique: true,
    required: true,
    default: 'defaultSettings', 
  },
  defaultDailyHours: {
    type: Number,
    required: [true, 'Default daily working hours are required.'],
    default: 8,
  },
  defaultOtRate: {
    type: Number,
    required: [true, 'Default OT rate is required.'],
    default: 50,
  },
  defaultExtraDayRate: {
    type: Number,
    required: [true, 'Default extra day rate is required.'],
    default: 100,
  },
  // --- NEW SCHEMA DEFINITIONS ---
  loyaltyPointPerPrice: {
    type: Number,
    default: 100, // e.g., for every ₹100 spent
  },
  loyaltyPointsAwarded: {
    type: Number,
    default: 1,   // e.g., the customer gets 1 point
  },
}, { timestamps: true });

// Prevent recompilation of the model if it already exists
const ShopSetting: Model<IShopSetting> = mongoose.models.ShopSetting || mongoose.model<IShopSetting>('ShopSetting', ShopSettingSchema);

export default ShopSetting;