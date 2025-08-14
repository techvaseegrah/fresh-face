import mongoose, { Document, Schema, Model, models } from 'mongoose';
import { IProduct } from './Product';

// The IUser interface can be simplified or expanded as needed.
// This is just a placeholder for population.
interface IUser extends Document {
  name: string;
}

export enum PurchaseOrderStatus {
  PENDING_ADMIN_REVIEW = 'Pending Admin Review',
  PENDING_OWNER_APPROVAL = 'Pending Owner Approval',
  APPROVED = 'Approved',
  ORDERED = 'Ordered',
  PARTIALLY_RECEIVED = 'Partially Received',
  RECEIVED = 'Received',
  CANCELLED = 'Cancelled',
}

// Sub-document for products within a PO. No tenantId needed here as it's embedded.
interface IPOProduct extends Document {
  product: mongoose.Types.ObjectId | IProduct; 
  requestedQuantity: number;                 
  requestedPrice: number;                    
  approvedQuantity: number;                  
  approvedPrice: number;                     
  receivedQuantity: number;                  
}

export interface IPurchaseOrder extends Document {
  tenantId: string; // <-- 1. ADDED: The ID of the tenant this PO belongs to.
  poId: string; 
  products: IPOProduct[]; 
  status: PurchaseOrderStatus; 
  managerRemarks?: string; 
  adminRemarks?: string;   
  ownerRemarks?: string;   
  expectedDeliveryDate: Date;
  createdBy: mongoose.Types.ObjectId | IUser; 
  reviewedBy?: mongoose.Types.ObjectId | IUser; 
  approvedBy?: mongoose.Types.ObjectId | IUser; 
  invoiceUrl?: string; 
  history: {
    status: PurchaseOrderStatus;
    updatedBy: mongoose.Types.ObjectId | IUser;
    timestamp: Date;
    notes?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const POProductSchema = new Schema<IPOProduct>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  requestedQuantity: { type: Number, required: true, min: 1 },
  requestedPrice: { type: Number, required: true, min: 0 },
  approvedQuantity: { type: Number, default: 0 },
  approvedPrice: { type: Number, default: 0 },
  receivedQuantity: { type: Number, default: 0 },
});

const PurchaseOrderSchema = new Schema<IPurchaseOrder>({
  // --- MODIFICATIONS FOR TENANCY ---
  tenantId: { type: String, required: true, index: true }, // <-- 2. ADDED: Required and indexed for fast lookups.
  poId: { type: String, required: true }, // <-- 3. MODIFIED: Removed the global `unique: true` constraint.
  // ---------------------------------

  products: [POProductSchema],
  status: { type: String, enum: Object.values(PurchaseOrderStatus), default: PurchaseOrderStatus.PENDING_ADMIN_REVIEW },
  managerRemarks: { type: String, trim: true },
  adminRemarks: { type: String, trim: true },
  ownerRemarks: { type: String, trim: true },
  expectedDeliveryDate: { type: Date, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  invoiceUrl: { type: String },
  history: [{
    status: { type: String, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    notes: String,
  }],
}, { timestamps: true }); 

// 4. ADDED: Create a compound index.
// This ensures that the `poId` is unique *per tenant*, which is the correct behavior.
// Now, Tenant A and Tenant B can both have a 'PO-2023-001'.
PurchaseOrderSchema.index({ tenantId: 1, poId: 1 }, { unique: true });


const PurchaseOrderModel: Model<IPurchaseOrder> = models.PurchaseOrder || mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);

export default PurchaseOrderModel;