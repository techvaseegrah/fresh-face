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
    trim: true,
  },
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    // Email should be unique globally, so this is correct.
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
}, { timestamps: true });

// --- ✅ FIX: Create compound indexes for tenant-scoped uniqueness ---
staffSchema.index({ tenantId: 1, staffIdNumber: 1 }, { unique: true });
staffSchema.index({ tenantId: 1, aadharNumber: 1 }, { unique: true });

// Index for better query performance on common filters
staffSchema.index({ status: 1, name: 1 });

let Staff: Model<IStaff>;

try {
  // Try to retrieve existing model to prevent recompilation error in Next.js
  Staff = mongoose.model<IStaff>('Staff');
} catch {
  // Define the model if it doesn't exist
  Staff = mongoose.model<IStaff>('Staff', staffSchema);
}

export default Staff;