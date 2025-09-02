// src/models/PackageTemplate.ts

import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for a single item within the package template
export interface IPackageTemplateItem {
  itemType: 'service' | 'product';
  itemId: mongoose.Schema.Types.ObjectId; // Refers to 'Service' or 'Product' model
  quantity: number;
}

// Interface for the Package Template document
export interface IPackageTemplate extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  items: IPackageTemplateItem[];
  validityInDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PackageTemplateItemSchema = new Schema<IPackageTemplateItem>({
  itemType: { type: String, enum: ['service', 'product'], required: true },
  // NOTE: We will need to ensure 'Service' and 'Product' models exist.
  // We don't use a dynamic 'ref' here as it can be complex. We'll manage the reference in our application logic.
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const PackageTemplateSchema = new Schema<IPackageTemplate>({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  items: [PackageTemplateItemSchema],
  validityInDays: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const PackageTemplate: Model<IPackageTemplate> = mongoose.models.PackageTemplate || mongoose.model<IPackageTemplate>('PackageTemplate', PackageTemplateSchema);

export default PackageTemplate;