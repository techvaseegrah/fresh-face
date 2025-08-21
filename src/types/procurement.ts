// src/types/procurement.ts

import mongoose from 'mongoose';

// Minimal IProduct definition to break the chain.
// This prevents importing the entire Product model.

export interface IProduct {
  _id: string;
  name: string;
  sku: string;
  price?: number;
}

// Minimal IUser definition
export interface IUser {
  _id: string;
  name: string;
}

export enum PurchaseOrderStatus {
  // ... enum values
  PENDING_ADMIN_REVIEW = 'Pending Admin Review',
  PENDING_OWNER_APPROVAL = 'Pending Owner Approval',
  APPROVED = 'Approved',
  ORDERED = 'Ordered',
  PARTIALLY_RECEIVED = 'Partially Received',
  RECEIVED = 'Received',
  CANCELLED = 'Cancelled',
}

export interface IPOProduct {
  _id: string;
  product: IProduct; 
  requestedQuantity: number;
  requestedPrice: number;
  approvedQuantity: number;
  approvedPrice: number;
  receivedQuantity: number;
}

export interface IPurchaseOrder {
  _id: string; 
  poId: string;
  products: IPOProduct[];
  status: PurchaseOrderStatus;
  managerRemarks?: string;
  adminRemarks?: string;
  ownerRemarks?: string;
  expectedDeliveryDate: Date;
  createdBy: IUser; // Use the minimal IUser interface
  reviewedBy?: IUser;
  approvedBy?: IUser;
  invoiceUrl?: string;
  history: {
    status: PurchaseOrderStatus;
    updatedBy: IUser;
    timestamp: Date;
    notes?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}