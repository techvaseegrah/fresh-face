import mongoose, { Schema, model, models, Document } from 'mongoose';

// A flexible schema for payment totals (used for expected, actual, and discrepancies)
// We'll add 'other' to match your invoice logic and make it more flexible.
const TotalsSchema = new Schema({
  cash: { type: Number, default: 0 },
  card: { type: Number, default: 0 },
  upi: { type: Number, default: 0 },
  other: { type: Number, default: 0 }, // Added for consistency
  total: { type: Number, default: 0 },
}, { _id: false });


// Main DayEndReport schema
const DayEndReportSchema = new Schema({
  closingDate: {
    type: Date,
    required: true,
    unique: true,
    index: true,
  },
  
  // --- NEW FIELDS FOR COMPLETE CASH FLOW ---
  openingBalance: {
    type: Number,
    required: true,
    default: 0,
  },
  isOpeningBalanceManual: {
    type: Boolean,
    default: false, // Tracks if the user overrode the automated value
  },
  
  pettyCash: {
    total: { type: Number, default: 0 },
    // This stores an array of IDs that link directly to your 'Expense' collection.
    // This is the correct way to handle relationships in MongoDB.
    expenseIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'Expense' // This 'ref' tells Mongoose to link to the 'Expense' model
    }], 
  },
  // --- END OF NEW FIELDS ---

  // Renamed for clarity and consistency. Using the same TotalsSchema for all.
  expectedTotals: TotalsSchema, // Totals from system (sales)
  actualTotals: TotalsSchema,   // Totals from physical count/verification
  discrepancies: TotalsSchema,  // Calculated differences

  // Using a Map is more flexible than a rigid schema for denominations.
  // It allows you to store keys like 'd500', 'd200', etc., without defining them all.
  cashDenominations: {
    type: Map,
    of: Number,
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


// Optional: Define a TypeScript interface for better type safety in your app
export interface IDayEndReport extends Document {
  closingDate: Date;
  openingBalance: number;
  isOpeningBalanceManual: boolean;
  pettyCash: {
    total: number;
    expenseIds: mongoose.Types.ObjectId[];
  };
  expectedTotals: { cash: number; card: number; upi: number; other: number; total: number };
  actualTotals: { cash: number; card: number; upi: number; other: number; total: number };
  discrepancies: { cash: number; card: number; upi: number; other: number; total: number };
  cashDenominations: Map<string, number>;
  notes?: string;
  closedBy: mongoose.Types.ObjectId;
}

const DayEndReport = models.DayEndReport || model<IDayEndReport>('DayEndReport', DayEndReportSchema);

export default DayEndReport;