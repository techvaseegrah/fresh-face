import mongoose, { Schema, model, models } from 'mongoose';

const ServiceSchema = new Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  durationMinutes: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Service = models.Service || model('Service', ServiceSchema);
export default Service;