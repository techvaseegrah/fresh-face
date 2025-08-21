// models/TargetSheet.ts

import { Schema, model, models, Document } from 'mongoose';

export interface SummaryMetrics {
  service: number;
  retail: number;
  netSales: number;
  bills: number;
  abv: number;
  callbacks: number;
  appointments: number;
}

export interface TargetSheetData {
  _id: string;
  month: string;
  summary: {
    target: Partial<SummaryMetrics>;
    achieved: Partial<SummaryMetrics>;
    headingTo: Partial<SummaryMetrics>;
  };
}

interface ITargetSheet extends Document {
  month: string;
  tenantId: Schema.Types.ObjectId;
  target: {
    service: number;
    retail: number;
    bills: number;
    abv: number;
    callbacks: number;
    appointments: number;
  };
}

const TargetMetricsSchema = new Schema({
  service: { type: Number, default: 0 },
  retail: { type: Number, default: 0 },
  bills: { type: Number, default: 0 },
  abv: { type: Number, default: 0 },
  callbacks: { type: Number, default: 0 },
  appointments: { type: Number, default: 0 },
}, { _id: false });


const TargetSheetSchema = new Schema<ITargetSheet>({
  // --- CORRECTED ---
  // The "unique: true" property has been REMOVED from this line.
  // This was the cause of the E11000 error.
  month: { type: String, required: true, trim: true },

  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  target: { type: TargetMetricsSchema, default: () => ({}) },
}, { timestamps: true });

// --- CORRECTED ---
// This line creates the proper COMPOUND unique index.
// It ensures that the combination of 'month' and 'tenantId' is unique.
TargetSheetSchema.index({ month: 1, tenantId: 1 }, { unique: true });

const TargetSheet = models.TargetSheet || model<ITargetSheet>('TargetSheet', TargetSheetSchema);

export default TargetSheet;