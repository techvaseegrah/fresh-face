// src/models/CustomerPackage.ts

import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for tracking remaining items in a customer's package
export interface IRemainingItem {
  itemType: 'service' | 'product';
  itemId: mongoose.Schema.Types.ObjectId;
  totalQuantity: number;
  remainingQuantity: number;
}

// Interface for the Customer Package document
export interface ICustomerPackage extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  customerId: mongoose.Schema.Types.ObjectId;
  packageTemplateId: mongoose.Schema.Types.ObjectId;
  purchaseDate: Date;
  expiryDate: Date;
  status: 'active' | 'completed' | 'expired';
  remainingItems: IRemainingItem[];
  // We can store a denormalized name for easier display
  packageName: string; 
  createdAt: Date;
  updatedAt: Date;
}

const RemainingItemSchema = new Schema<IRemainingItem>({
  itemType: { type: String, enum: ['service', 'product'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  totalQuantity: { type: Number, required: true },
  remainingQuantity: { type: Number, required: true },
}, { _id: false });

const CustomerPackageSchema = new Schema<ICustomerPackage>({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  packageTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'PackageTemplate', required: true },
  purchaseDate: { type: Date, required: true, default: Date.now },
  expiryDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'completed', 'expired'], default: 'active', index: true },
  remainingItems: [RemainingItemSchema],
  packageName: { type: String, required: true },
}, { timestamps: true });

const CustomerPackage: Model<ICustomerPackage> = mongoose.models.CustomerPackage || mongoose.model<ICustomerPackage>('CustomerPackage', CustomerPackageSchema);

export default CustomerPackage;