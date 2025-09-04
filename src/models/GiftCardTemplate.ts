import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for TypeScript type safety
export interface IGiftCardTemplate extends Document {
  name: string;
  description?: string;
  amount: number;
  validityInDays: number;
  isActive: boolean;
  tenantId: mongoose.Schema.Types.ObjectId;
}

// Mongoose Schema
const GiftCardTemplateSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: [true, 'Gift card name is required.'] 
  },
  description: { 
    type: String 
  },
  amount: { 
    type: Number, 
    required: [true, 'Gift card amount is required.'] 
  },
  validityInDays: { 
    type: Number, 
    required: [true, 'Validity period in days is required.'] 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true 
  },
}, { timestamps: true });

// Prevent model overwrite in Next.js hot reloading
export const GiftCardTemplate: Model<IGiftCardTemplate> = 
  mongoose.models.GiftCardTemplate || mongoose.model<IGiftCardTemplate>('GiftCardTemplate', GiftCardTemplateSchema);