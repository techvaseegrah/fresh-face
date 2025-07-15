// src/models/ShopSetting.ts

import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// --- (NEW) --- Define the structure for a single position's hour setting
// This will be a sub-document within the main ShopSetting document.
export interface IPositionHourSetting {
  _id?: Types.ObjectId; // Mongoose automatically adds this, good to have in interface
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
}, { _id: false }); // We don't need a separate _id for each sub-document here

// --- UPDATED INTERFACE ---
// All your original fields are kept, and the new one is added.
export interface IShopSetting extends Document {
  key: string; 
  defaultDailyHours: number;
  defaultOtRate: number;
  defaultExtraDayRate: number;
  loyaltyPointPerPrice: number;
  loyaltyPointsAwarded: number;
  staffIdBaseNumber: number;
  positionHours: IPositionHourSetting[]; // --- (NEW) --- Add new field to the interface
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
  staffIdBaseNumber: {
    type: Number,
    required: [true, 'Staff ID base number is required.'],
    default: 3101,
  },
  // --- (NEW) --- Add the new array field to the schema, using the sub-schema
  positionHours: {
      type: [PositionHourSettingSchema],
      default: [],
  }
}, { timestamps: true });

// Prevent recompilation of the model if it already exists
const ShopSetting: Model<IShopSetting> = mongoose.models.ShopSetting || mongoose.model<IShopSetting>('ShopSetting', ShopSettingSchema);

export default ShopSetting;