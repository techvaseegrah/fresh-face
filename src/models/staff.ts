// FILE: src/models/staff.ts

import mongoose, { Document, Model, Schema, Types } from 'mongoose';

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
    // unique: true, // <<< REMOVED THIS
    trim: true,
  },
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    unique: true,
    sparse: true, // This is fine, email should be globally unique
    trim: true,
    lowercase: true,
  },
  phone: { type: String, trim: true },
  aadharNumber: {
    type: String,
    required: true,
    // unique: true, // <<< REMOVED THIS
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
}, { timestamps: true });

// --- THIS IS THE FIX ---
// Create compound indexes to ensure uniqueness is scoped to each tenant.
staffSchema.index({ tenantId: 1, staffIdNumber: 1 }, { unique: true });
staffSchema.index({ tenantId: 1, aadharNumber: 1 }, { unique: true });

staffSchema.index({ status: 1, name: 1 });

let Staff: Model<IStaff>;

try {
  Staff = mongoose.model<IStaff>('Staff');
} catch {
  Staff = mongoose.model<IStaff>('Staff', staffSchema);
}

export default Staff;