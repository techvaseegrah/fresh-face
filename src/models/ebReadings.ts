import mongoose, { Schema, Document } from 'mongoose';

export interface IEBReading extends Document {
  date: Date;
  startUnits?: number;
  endUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
  startImageUrl?: string;
  endImageUrl?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EBReadingSchema = new Schema<IEBReading>({
  date: { type: Date, required: true, default: Date.now },
  startUnits: { type: Number, required: false },
  endUnits: { type: Number, required: false },
  unitsConsumed: { type: Number, required: false },
  costPerUnit: { type: Number, required: false },
  totalCost: { type: Number, required: false },
  startImageUrl: { type: String, required: false },
  endImageUrl: { type: String, required: false },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.EBReading || mongoose.model<IEBReading>('EBReading', EBReadingSchema);