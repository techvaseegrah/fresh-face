// FILE: /models/DayEndReport.ts

import mongoose, { Schema, model, models } from 'mongoose';

// Structure for the counted cash denominations
const cashDenominationsSchema = new Schema({
  d2000: { type: Number, default: 0 },
  d500: { type: Number, default: 0 },
  d200: { type: Number, default: 0 },
  d100: { type: Number, default: 0 },
  d50: { type: Number, default: 0 },
  d20: { type: Number, default: 0 },
  d10: { type: Number, default: 0 },
  d1: { type: Number, default: 0 }, // For coins
}, { _id: false });

const totalsSchema = new Schema({
  cash: { type: Number, default: 0 },
  card: { type: Number, default: 0 },
  upi: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  unknown: { type: Number, default: 0 },
}, { _id: false });

const dayEndReportSchema = new Schema({
  closingDate: {
    type: Date,
    required: true,
    unique: true, // You should only have one report per day
    index: true,
  },
  
  // Data from the system (calculated from invoices)
  expected: totalsSchema,
  
  // Data from physical count (submitted by manager)
  actual: {
    card: { type: Number, default: 0 },
    upi: { type: Number, default: 0 },
    cashDenominations: cashDenominationsSchema,
    totalCountedCash: { type: Number, required: true },
  },
  
  // Calculated discrepancies
  discrepancy: {
    cash: { type: Number, required: true },
    card: { type: Number, required: true },
    upi: { type: Number, required: true },
    total: { type: Number, required: true },
  },

  notes: {
    type: String,
    trim: true,
  },

  closedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

}, { timestamps: true });

const DayEndReport = models.DayEndReport || model('DayEndReport', dayEndReportSchema);

export default DayEndReport;