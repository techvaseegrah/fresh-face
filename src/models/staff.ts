// /models/staff.ts

import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs'; // Import bcrypt

export interface IStaff extends Document {
  _id: Types.ObjectId;
  staffIdNumber: string;
  tenantId: mongoose.Schema.Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  aadharNumber: string;
  position: string;
  joinDate: Date;
  salary?: number;
  address?: string;
  image?: string;
  status: 'active' | 'inactive';
  aadharImage?: string;
  passbookImage?: string;
  agreementImage?: string;
  password?: string; // <-- ADD THIS FIELD
}

const staffSchema = new Schema<IStaff>({
  tenantId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  staffIdNumber: {
    type: String,
    required: [true, 'Staff ID number is required.'],
    trim: true,
  },
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    unique: true,
    sparse: true, 
    trim: true,
    lowercase: true,
  },
  phone: { type: String, trim: true },
  aadharNumber: {
    type: String,
    required: true,
    trim: true,
  },
  position: { type: String, required: true, trim: true },
  joinDate: { type: Date, default: Date.now },
  salary: { type: Number },
  address: { type: String, trim: true },
  image: { type: String, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  aadharImage: { type: String },
  passbookImage: { type: String },
  agreementImage: { type: String },
  // --- ✅ ADDED PASSWORD FIELD ---
  password: {
    type: String,
    required: [true, 'Password is required for staff members.'],
    minlength: 6,
   maxlength: 60, // ✨ CHANGE THIS LINE FROM 15 TO 60 ✨
    select: false, // Important: Hides password from default queries
  },
}, { timestamps: true });

// --- Compound indexes for tenant-scoped uniqueness ---
staffSchema.index({ tenantId: 1, staffIdNumber: 1 }, { unique: true });
staffSchema.index({ tenantId: 1, aadharNumber: 1 }, { unique: true });

// Index for better query performance on common filters
staffSchema.index({ status: 1, name: 1 });


let Staff: Model<IStaff>;

try {
  Staff = mongoose.model<IStaff>('Staff');
} catch {
  Staff = mongoose.model<IStaff>('Staff', staffSchema);
}

export default Staff;
