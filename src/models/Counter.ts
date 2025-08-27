import { model, models, Schema, Model, Document } from "mongoose";

// Optional but good practice: Define an interface for type safety
export interface ICounter extends Document {
  _id: string;
  seq: number;
}

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

// The check `models.Counter` prevents Mongoose from recompiling the model
const Counter: Model<ICounter> = models.Counter || model<ICounter>('Counter', counterSchema);

export default Counter; // <-- THE FIX: Make the model available for import