import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITenant extends Document {
  name: string; // Example: "Fresh Face Salon"
  subdomain: string; // Example: "fresh-face-salon"
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
}, { timestamps: true });

// Prevent model recompilation in Next.js
const Tenant: Model<ITenant> = mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);

export default Tenant;