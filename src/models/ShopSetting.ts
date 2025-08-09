// src/models/ShopSetting.ts

import mongoose, { Document, Model, Schema } from 'mongoose';

// --- SUB-DOCUMENT: RATE SETTINGS ---
// This defines the structure for a single position's RATE settings.
export interface IPositionRateSetting {
  positionName: string;
  otRate: number;
  extraDayRate: number;
}

const PositionRateSettingSchema: Schema<IPositionRateSetting> = new Schema({
    // REMOVED: `tenantId` does not belong in a sub-document. The parent document has it.
    positionName: {
        type: String,
        required: true,
        trim: true,
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


// --- SUB-DOCUMENT: HOUR SETTINGS ---
// This defines the structure for a single position's HOUR settings.
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


// --- MAIN INTERFACE ---
// This interface now includes the required `tenantId`.
export interface IShopSetting extends Document {
  key: string;
  tenantId: mongoose.Schema.Types.ObjectId; // <-- FIX #1: Added tenantId
  defaultDailyHours: number;
  defaultOtRate: number;
  defaultExtraDayRate: number;
  loyaltyPointPerPrice: number;
  loyaltyPointsAwarded: number;
  staffIdBaseNumber: number;
  positionRates: IPositionRateSetting[];
  positionHours: IPositionHourSetting[];
}

// --- MAIN SCHEMA ---
// The final schema containing all fields, structured for multi-tenancy.
const ShopSettingSchema: Schema<IShopSetting> = new Schema({
  key: {
    type: String,
    // unique: true, // <-- FIX #2: REMOVED global unique constraint.
    required: true,
    default: 'defaultSettings',
  },
  // --- FIX #3: ADDED the tenantId field to the main schema ---
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant', // This should match your Tenant model name
    required: true,
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

// --- FIX #4: CREATED the correct multi-tenant unique index ---
// This ensures the `key` is unique *per tenant*, not globally.
ShopSettingSchema.index({ tenantId: 1, key: 1 }, { unique: true });


const ShopSetting: Model<IShopSetting> = mongoose.models.ShopSetting || mongoose.model<IShopSetting>('ShopSetting', ShopSettingSchema);

export default ShopSetting;