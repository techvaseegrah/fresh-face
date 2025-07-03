// src/models/Staff.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IStaff extends Document {
  _id: Types.ObjectId; // Explicitly ensure _id is here for clarity with LeanStaffDocument
  name: string;
  email: string;
  phone?: string;
  aadharNumber?: string; // Added Aadhar Number field
  position: string;
  joinDate: Date;
  salary?: number;
  address?: string;
  image?: string;
  status: 'active' | 'inactive';
}

const staffSchema = new Schema<IStaff>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  // Added Aadhar Number to the schema. 
  // `unique` ensures no two staff members have the same number.
  // `sparse` allows multiple documents to not have this field (since it's optional).
  aadharNumber: { type: String, trim: true, unique: true, sparse: true },
  position: { type: String, required: true, trim: true },
  joinDate: { type: Date, default: Date.now },
  salary: { type: Number },
  address: { type: String, trim: true },
  image: { type: String, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

staffSchema.index({ email: 1 });
staffSchema.index({ status: 1, name: 1 });

const Staff: Model<IStaff> = mongoose.models.Staff || mongoose.model<IStaff>('Staff', staffSchema);
export default Staff;