// src/models/CustomerPackageLog.ts

import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for the Customer Package Log document
export interface ICustomerPackageLog extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  customerPackageId: mongoose.Schema.Types.ObjectId;
  customerId: mongoose.Schema.Types.ObjectId;
  redeemedItemId: mongoose.Schema.Types.ObjectId;
  redeemedItemType: 'service' | 'product';
  quantityRedeemed: number;
  redemptionDate: Date;
  invoiceId: mongoose.Schema.Types.ObjectId; // Crucial link to the bill/invoice
  redeemedBy: mongoose.Schema.Types.ObjectId; // Staff member who processed it
  createdAt: Date;
  updatedAt: Date;
}

const CustomerPackageLogSchema = new Schema<ICustomerPackageLog>({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  customerPackageId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerPackage', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  redeemedItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  redeemedItemType: { type: String, enum: ['service', 'product'], required: true },
  quantityRedeemed: { type: Number, required: true, default: 1 },
  redemptionDate: { type: Date, default: Date.now },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
}, { timestamps: true });

const CustomerPackageLog: Model<ICustomerPackageLog> = mongoose.models.CustomerPackageLog || mongoose.model<ICustomerPackageLog>('CustomerPackageLog', CustomerPackageLogSchema);

export default CustomerPackageLog;