import mongoose, { Schema, Document, Model, models } from 'mongoose';

// Interface for the History sub-document to track changes
export interface IHistoryEntry extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  timestamp: Date;
  user: {
    id: string;
    name: string;
  };
  changes: {
    field: string;
    oldValue?: any; // Use 'any' as it can be mixed types
    newValue?: any;
  }[];
}

// The main EBReading Interface
export interface IEBReading extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  date: Date;
  morningUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
  morningImageUrl?: string;
  history: IHistoryEntry[];
  createdBy: string;
  updatedBy?: string;
}

// Sub-schema for tracking changes within the history array
const HistorySchema = new Schema<IHistoryEntry>({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  user: {
    id: { type: String, required: true },
    name: { type: String, required: true },
  },
  changes: [{
    _id: false, // Don't create an _id for each change object
    field: { type: String, required: true },
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
  }],
}, { _id: false }); // Do not create a separate _id for the History sub-document itself

// The main schema for EBReadings
const EBReadingSchema = new Schema<IEBReading>({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true // A regular index on tenantId is good for performance
  },
  date: { 
    type: Date, 
    required: true, 
    // `unique: true` has been REMOVED from here.
  },
  morningUnits: { type: Number, required: false },
  unitsConsumed: { type: Number, required: false },
  costPerUnit: { type: Number, required: false, default: 8 }, // A sensible default
  totalCost: { type: Number, required: false },
  morningImageUrl: { type: String, required: false },
  history: [HistorySchema],
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: false },
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// --- THIS IS THE CORRECTED PART ---
// Create a compound unique index on the combination of tenantId and date.
// This ensures that a date is unique PER TENANT, which is the correct
// multi-tenant logic.
EBReadingSchema.index({ tenantId: 1, date: 1 }, { unique: true });

// Check if the model already exists before compiling it
const EBReading: Model<IEBReading> = models.EBReading || mongoose.model<IEBReading>('EBReading', EBReadingSchema);

export default EBReading;