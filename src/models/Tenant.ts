import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  subdomain: string;
  // ✅ ADD THESE NEW FIELDS
  address?: string;
  phone?: string;
  gstin?: string; // Optional field for GST Identification Number
}

const TenantSchema: Schema<ITenant> = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  subdomain: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    lowercase: true,
    trim: true
  },
  // ✅ DEFINE THE NEW FIELDS IN THE SCHEMA
  address: {
    type: String,
  },
  phone: {
    type: String,
  },
  gstin: {
    type: String,
  }
}, { timestamps: true });

const Tenant: Model<ITenant> = mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);

export default Tenant;