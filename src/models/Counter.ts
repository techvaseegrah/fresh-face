import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for our Counter document
export interface ICounter extends Document {
  _id: string; // The name of the sequence, e.g., 'staffId'
  seq: number; // The last sequence number used
}

// Schema for the Counter
const CounterSchema: Schema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

// Helper function to get the next sequence value atomically
// It finds the counter, increments 'seq' by 1, and returns the new value.
// 'upsert: true' creates the document if it doesn't exist on the first run.
export async function getNextSequenceValue(sequenceName: string): Promise<number> {
  const counter = await (mongoose.models.Counter as Model<ICounter>).findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

// Export the model, preventing recompilation in the Next.js dev environment
export default (mongoose.models.Counter as Model<ICounter>) || mongoose.model<ICounter>('Counter', CounterSchema);