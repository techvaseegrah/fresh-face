import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for our setting's value object for type safety
export interface ILoyaltySettings {
  rupeesForPoints: number; // e.g., 100
  pointsAwarded: number;   // e.g., 6
}

// Interface for the whole document
export interface ISetting extends Document {
  key: string; // This will be 'loyalty'
  value: ILoyaltySettings;
}

const settingSchema: Schema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true, // Ensures we only have one 'loyalty' setting document
    index: true,
  },
  value: {
    type: Object,
    required: true,
  },
}, {
  timestamps: true // Keep timestamps to see when it was last changed
});

const Setting: Model<ISetting> = mongoose.models.Setting || mongoose.model<ISetting>('Setting', settingSchema);

export default Setting;