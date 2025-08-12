import { model, models, Schema } from "mongoose";

// /models/Counter.ts
const counterSchema = new Schema({
  _id: { type: String, required: true }, // e.g., 'invoice_counter_tenant_A'
  seq: { type: Number, default: 0 }
});
const Counter = models.Counter || model('Counter', counterSchema);