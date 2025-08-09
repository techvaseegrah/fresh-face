// /models/ServiceItem.ts - FINAL CORRECTED VERSION

import mongoose, { Document, Schema, Model, models } from 'mongoose';

// Interface for the embedded consumable document
export interface IServiceConsumable {
  product: mongoose.Types.ObjectId;
  quantity: {
    male?: number;
    female?: number;
    default: number;
  };
  unit: string;
}

// Interface for the main ServiceItem document
export interface IServiceItem extends Document {
  tenantId: mongoose.Types.ObjectId;
  serviceCode: string;
  name: string;
  price: number;
  membershipRate?: number;
  duration: number;
  subCategory: mongoose.Types.ObjectId;
  consumables: IServiceConsumable[];
}

// Schema for the embedded consumable
const serviceConsumableSchema = new Schema<IServiceConsumable>({
  // NO tenantId here. It's inherited from the parent.
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: {
    male: { type: Number, min: 0 },
    female: { type: Number, min: 0 },
    default: { type: Number, min: 0, required: true }
  },
  unit: { type: String, required: true, trim: true }
}, { _id: false });


// Schema for the main ServiceItem
const serviceItemSchema = new Schema<IServiceItem>({
  tenantId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  serviceCode: {
    type: String,
    required: [true, 'Service Code is required.'],
    trim: true,
    uppercase: true,
  },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  membershipRate: { type: Number, min: 0 },
  duration: { type: Number, required: true, min: 1 },
  subCategory: { type: Schema.Types.ObjectId, ref: 'ServiceSubCategory', required: true },
  consumables: [serviceConsumableSchema]
}, { timestamps: true });


// =========================================================================
// === THE DATABASE-LEVEL FIX IS HERE ===
// This index ensures that the combination of serviceCode and tenantId is unique.
// This is what allows your error message to be so specific.
// =========================================================================
serviceItemSchema.index({ serviceCode: 1, tenantId: 1 }, { unique: true });

const ServiceItem: Model<IServiceItem> = models.ServiceItem || mongoose.model<IServiceItem>('ServiceItem', serviceItemSchema);

export default ServiceItem;