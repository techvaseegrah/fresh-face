// src/models/ShopSetting.ts

import mongoose, { Document, Model, Schema } from 'mongoose';

// --- SUB-DOCUMENT: IPositionRateSetting ---
// Defines the structure for a single position's RATE settings.
export interface IPositionRateSetting {
  positionName: string;
  otRate: number;
  extraDayRate: number;
}

const PositionRateSettingSchema: Schema<IPositionRateSetting> = new Schema({
  // --- REMOVED ---
  // The 'tenantId' field has been removed from this sub-document schema.
  // It is now defined on the main ShopSettingSchema.

  positionName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
  },
  otRate: {
      type: Number,
      required: true,
      default: 0,
  },
  extraDayRate: {
      type: Number,
      required: true,
      default: 0,
  }
}, { _id: false });


// --- SUB-DOCUMENT: IPositionHourSetting ---
// This schema remains unchanged.
export interface IPositionHourSetting {
  positionName: string;
  requiredHours: number;
}

const PositionHourSettingSchema: Schema<IPositionHourSetting> = new Schema({
    positionName: {
        type: String,
        required: true,
        trim: true,
    },
    requiredHours: {
        type: Number,
        required: true,
        default: 8,
    }
}, { _id: false });


// --- COMBINED MAIN INTERFACE ---
// This interface now includes tenantId at the top level.
export interface IShopSetting extends Document {
  tenantId: mongoose.Schema.Types.ObjectId; // <-- ADDED: tenantId now belongs to the main document.
  key: string; 
  defaultDailyHours: number;
  defaultOtRate: number;
  defaultExtraDayRate: number;
  loyaltyPointPerPrice: number;
  loyaltyPointsAwarded: number;
  staffIdBaseNumber: number;
  positionRates: IPositionRateSetting[];
  positionHours: IPositionHourSetting[];
}

// --- COMBINED MAIN SCHEMA ---
// The final schema containing all fields, with tenantId at the root level.
const ShopSettingSchema: Schema<IShopSetting> = new Schema({
  // --- MOVED HERE ---
  // The tenantId now applies to the entire ShopSetting document, which is the correct approach.
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, // Corrected to use the imported mongoose object
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
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
  staffIdBaseNumber: {
    type: Number,
    required: [true, 'Staff ID base number is required.'],
    default: 3101,
  },
  positionRates: {
      type: [PositionRateSettingSchema],
      default: [],
  },
  positionHours: {
      type: [PositionHourSettingSchema],
      default: [],
  }
}, { timestamps: true });

// Note on indexing: If the 'key' should be unique *per tenant* instead of globally unique,
// you should change the index like this:
// ShopSettingSchema.index({ tenantId: 1, key: 1 }, { unique: true });
// And remove `unique: true` from the `key` field definition itself.

// Prevent recompilation of the model if it already exists
const ShopSetting: Model<IShopSetting> = mongoose.models.ShopSetting || mongoose.model<IShopSetting>('ShopSetting', ShopSettingSchema);

export default ShopSetting;