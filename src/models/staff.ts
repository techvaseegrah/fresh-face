// src/models/Staff.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// --- (MODIFIED) --- Added staffIdNumber to the interface
export interface IStaff extends Document {
  _id: Types.ObjectId;
  staffIdNumber: string; // The unique identifier for the staff member
  name: string;
  email: string;
  phone?: string;
  aadharNumber?: string;
  position: string;
  joinDate: Date;
  salary?: number;
  address?: string;
  image?: string;
  status: 'active' | 'inactive';
}

const staffSchema = new Schema<IStaff>({
  // --- (NEW) --- Added staffIdNumber to the schema with constraints
  staffIdNumber: {
    type: String,
    required: [true, 'Staff ID number is required.'],
    unique: true,
    trim: true,
  },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  aadharNumber: { type: String, trim: true, unique: true, sparse: true },
  position: { type: String, required: true, trim: true },
  joinDate: { type: Date, default: Date.now },
  salary: { type: Number },
  address: { type: String, trim: true },
  image: { type: String, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

// --- (MODIFIED) --- Mongoose automatically creates an index for unique fields.
// No new index is strictly needed, but it's good to be aware.
staffSchema.index({ email: 1 });
staffSchema.index({ status: 1, name: 1 });
// The `unique: true` on `staffIdNumber` already creates an index for it.

const Staff: Model<IStaff> = mongoose.models.Staff || mongoose.model<IStaff>('Staff', staffSchema);
export default Staff;