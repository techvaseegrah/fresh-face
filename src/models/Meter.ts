// src/models/Meter.ts (NEW FILE)

import mongoose, { Schema, Document, Model, models } from 'mongoose';

export interface IMeter extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  name: string; // User-friendly name, e.g., "EB Meter 01 (Main)"
  identifier: string; // Unique, URL-safe identifier, e.g., "eb-meter-01-main-1678886400000"
  createdBy: string;
}

const MeterSchema = new Schema<IMeter>({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  identifier: { type: String, required: true, unique: true, index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });

// Ensure that a meter name is unique per tenant to avoid confusion
MeterSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const Meter: Model<IMeter> = models.Meter || mongoose.model<IMeter>('Meter', MeterSchema);

export default Meter;