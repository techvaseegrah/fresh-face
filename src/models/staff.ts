// src/models/Staff.ts

import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IStaff extends Document {
  _id: Types.ObjectId;
  staffIdNumber: string; 
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
  // VERIFY THESE FIELDS EXIST
  aadharImage?: string;
  passbookImage?: string;
  agreementImage?: string;
}

const staffSchema = new Schema<IStaff>({
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
  // ADD THESE FIELDS TO THE SCHEMA DEFINITION
  aadharImage: { type: String, default: null },
  passbookImage: { type: String, default: null },
  agreementImage: { type: String, default: null },
}, { timestamps: true });

staffSchema.index({ email: 1 });
staffSchema.index({ status: 1, name: 1 });

const Staff: Model<IStaff> = mongoose.models.Staff || mongoose.model<IStaff>('Staff', staffSchema);
export default Staff;