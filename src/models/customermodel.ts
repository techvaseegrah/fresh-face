// models/customermodel.ts
import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  email: { type: String,unique: true, index: true },
  
  // ===> ADD THIS FIELD <===
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0 // Ensures points cannot go below zero at the database level
  },
   isActive: {
    type: Boolean,
    default: true,
    index: true // Add an index for performance when filtering for active customers
  },

}, { timestamps: true });

export default mongoose.models.Customer || mongoose.model('Customer', customerSchema);