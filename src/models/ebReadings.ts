// /models/ebReadings.ts

import mongoose, { Schema, Document, Model, models } from 'mongoose';

export interface IHistoryEntry extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  timestamp: Date;
  user: { id: string; name: string; };
  changes: { field: string; oldValue?: any; newValue?: any; }[];
}

export interface IEBReading extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  date: Date;
  meterIdentifier: string;
  morningUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
  morningImageUrl?: string;
  history: IHistoryEntry[];
  createdBy: string;
  updatedBy?: string;
}

const HistorySchema = new Schema<IHistoryEntry>({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  timestamp: { type: Date, default: Date.now },
  user: {
    id: { type: String, required: true },
    name: { type: String, required: true },
  },
  changes: [{
    _id: false,
    field: { type: String, required: true },
    newValue: Schema.Types.Mixed,
    oldValue: Schema.Types.Mixed,
  }],
}, { _id: false });

const EBReadingSchema = new Schema<IEBReading>({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  date: { type: Date, required: true },
  // சிரிய மாற்றம்: default மதிப்பும், enum-ம் சேர்க்கப்பட்டுள்ளது
  meterIdentifier: { 
    type: String, 
    required: true, 
    trim: true, 
    index: true, 
    enum: ['meter-1', 'meter-2'], // இது தவறான மதிப்புகள் வராமல் தடுக்கும்
    default: 'meter-1' 
  },
  morningUnits: { type: Number, required: false },
  unitsConsumed: { type: Number, required: false },
  costPerUnit: { type: Number, required: false, default: 8 },
  totalCost: { type: Number, required: false },
  morningImageUrl: { type: String, required: false },
  history: [HistorySchema],
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: false },
}, { timestamps: true });

// இது ஏற்கெனவே சரியாகத்தான் உள்ளது. மாற்ற வேண்டாம்.
EBReadingSchema.index({ tenantId: 1, date: 1, meterIdentifier: 1 }, { unique: true });

const EBReading: Model<IEBReading> = models.EBReading || mongoose.model<IEBReading>('EBReading', EBReadingSchema);

export default EBReading;