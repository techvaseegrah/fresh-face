import mongoose, { Document, Schema, Model } from 'mongoose';

// --- CHANGES START HERE (in the Interface) ---

// Interface defining the document structure
export interface IDailyReconciliation extends Document {
  date: Date;
  tenantId: mongoose.Schema.Types.ObjectId;
  software: {
    serviceTotal: number;
    productTotal: number;
    cash: number;
    gpay: number;
    card: number;
    sumup: number;
    total: number;
  };
  bank: {
    gpayDeposit: number;
    cardDeposit: number;
    bankRemarks: string; // ADD THIS LINE: For bank-related notes
  };
  cash: {
    depositDone: number;
    expenses: number;
    closingCash: number;
    cashRemarks: string; // ADD THIS LINE: For cash-related notes
  };
  differences: {
    gpayDiff: number;
    cardDiff: number;
    cashDiff: number;
  };
  status: 'Pending' | 'Reconciled' | 'Discrepancy';
  notes?: string;
}

// --- CHANGES END HERE ---


// Mongoose Schema
const DailyReconciliationSchema: Schema = new Schema({
  date: { type: Date, required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  software: {
    serviceTotal: { type: Number, default: 0 },
    productTotal: { type: Number, default: 0 },
    cash: { type: Number, default: 0 },
    gpay: { type: Number, default: 0 },
    card: { type: Number, default: 0 },
    sumup: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },

  // --- CHANGES START HERE (in the Schema) ---
  bank: {
    gpayDeposit: { type: Number, default: 0 },
    cardDeposit: { type: Number, default: 0 },
    bankRemarks: {      // ADD THIS ENTIRE BLOCK
      type: String,
      trim: true,
      default: '',
    },
  },
  cash: {
    depositDone: { type: Number, default: 0 },
    expenses: { type: Number, default: 0 },
    closingCash: { type: Number, default: 0 },
    cashRemarks: {      // ADD THIS ENTIRE BLOCK
      type: String,
      trim: true,
      default: '',
    },
  },
  // --- CHANGES END HERE ---

  differences: {
    gpayDiff: { type: Number, default: 0 },
    cardDiff: { type: Number, default: 0 },
    cashDiff: { type: Number, default: 0 },
  },
  status: { type: String, enum: ['Pending', 'Reconciled', 'Discrepancy'], default: 'Pending' },
  notes: { type: String },
}, { timestamps: true });

// To prevent duplicate reports for the same day/tenant
DailyReconciliationSchema.index({ date: 1, tenantId: 1 }, { unique: true });

const DailyReconciliation: Model<IDailyReconciliation> = 
  mongoose.models.DailyReconciliation || mongoose.model<IDailyReconciliation>('DailyReconciliation', DailyReconciliationSchema);

export default DailyReconciliation;