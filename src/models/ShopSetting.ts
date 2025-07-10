// src/lib/models/ShopSetting.ts

import mongoose, { Document, Model, Schema } from 'mongoose';

// --- UPDATED INTERFACE ---
export interface IShopSetting extends Document {
  key: string; 
  defaultDailyHours: number;
  defaultOtRate: number;
  defaultExtraDayRate: number;
  loyaltyPointPerPrice: number;
  loyaltyPointsAwarded: number;
  staffIdBaseNumber: number; // --- (NEW) --- Add new field to the interface
}

const ShopSettingSchema: Schema<IShopSetting> = new Schema({
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
  loyaltyPointPerPrice: {
    type: Number,
    default: 100, 
  },
  loyaltyPointsAwarded: {
    type: Number,
    default: 1,   
  },
  // --- (NEW) --- Add the new field to the schema
  staffIdBaseNumber: {
    type: Number,
    required: [true, 'Staff ID base number is required.'],
    default: 3101, // Set your desired default starting number here
  },
}, { timestamps: true });

// Prevent recompilation of the model if it already exists
const ShopSetting: Model<IShopSetting> = mongoose.models.ShopSetting || mongoose.model<IShopSetting>('ShopSetting', ShopSettingSchema);

export default ShopSetting;