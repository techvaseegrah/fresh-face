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
    unique: true,
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
    unique: true,
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

staffSchema.index({ status: 1, name: 1 });


// --- MODIFIED EXPORT LOGIC ---
// This pattern is more resilient to Next.js hot-reloading issues.
let Staff: Model<IStaff>;

try {
  // Throws an error if "Staff" hasn't been registered
  Staff = mongoose.model<IStaff>('Staff');
} catch {
  // Defines the model only if it doesn't exist
  Staff = mongoose.model<IStaff>('Staff', staffSchema);
}
// --- END MODIFICATION ---

export default Staff;