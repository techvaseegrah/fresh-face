// FILE: src/models/ServiceItem.ts

// The main mongoose import is sufficient. We don't need to destructure 'models'.
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IServiceConsumable {
  product: mongoose.Types.ObjectId | any;
  quantity: {
    male?: number;
    female?: number;
    default: number;
  };
  unit: string;
}

export interface IServiceItem extends Document {
  _id: string;
  tenantId: mongoose.Schema.Types.ObjectId; // <-- ADDED tenantId
  serviceCode: string;
  name: string;
  price: number;
  membershipRate?: number;
  duration: number;
  subCategory: mongoose.Types.ObjectId | any;
  consumables: IServiceConsumable[];
}

// NOTE: The consumables sub-schema does NOT need a tenantId,
// as it is an embedded part of the parent ServiceItem which has the tenantId.
const serviceConsumableSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: {
    male: { type: Number, min: 0, required: false },
    female: { type: Number, min: 0, required: false },
    default: { type: Number, min: 0, required: true }
  },
  unit: { type: String, required: true, trim: true }
}, { _id: false });

const serviceItemSchema = new Schema({
  tenantId: { // <-- ADDED tenantId to the main schema
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
    index: true,
  },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  membershipRate: { type: Number, min: 0, sparse: true },
  duration: { type: Number, required: true, min: 1 },
  subCategory: { type: Schema.Types.ObjectId, ref: 'ServiceSubCategory', required: true },
  consumables: [serviceConsumableSchema]
}, { timestamps: true });

// --- MODIFIED EXPORT LOGIC ---
// This pattern is more resilient to Next.js hot-reloading issues.
let ServiceItem: Model<IServiceItem>;

try {
  // Throws an error if "ServiceItem" hasn't been registered
  ServiceItem = mongoose.model<IServiceItem>('ServiceItem');
} catch {
  // Defines the model only if it doesn't exist
  ServiceItem = mongoose.model<IServiceItem>('ServiceItem', serviceItemSchema);
}
// --- END MODIFICATION ---

export default ServiceItem;