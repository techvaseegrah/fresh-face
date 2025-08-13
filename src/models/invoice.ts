// /models/invoice.ts - CORRECTED VERSION

import mongoose, { Schema, model, models } from 'mongoose';
import Counter from './Counter'; // <--- FIX 1: IMPORT THE COUNTER MODEL

// --- This is the sub-schema for each item in the invoice ---
const lineItemSchema = new Schema({
  // ... (no changes here, your lineItemSchema is fine)
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  itemType: { type: String, enum: ['service', 'product', 'fee'], required: true },
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  membershipRate: { type: Number, sparse: true },
  finalPrice: { type: Number, required: true },
  membershipDiscount: { type: Number, default: 0 },
  staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: [true, 'A staff member must be assigned to each line item.'], index: true },
}, { _id: false });


// --- This is the main schema for the entire invoice ---
const invoiceSchema = new Schema({
  // ... (no changes in the main schema definition)
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  invoiceNumber: { type: String, unique: true, sparse: true, },
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  stylistId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  billingStaffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lineItems: [lineItemSchema],
  serviceTotal: { type: Number, required: true, default: 0 },
  productTotal: { type: Number, required: true, default: 0 },
  subtotal: { type: Number, required: true },
  membershipDiscount: { type: Number, default: 0 },
  manualDiscount: { type: { type: String, enum: ['fixed', 'percentage', null], default: null }, value: { type: Number, default: 0 }, appliedAmount: { type: Number, default: 0 } },
  grandTotal: { type: Number, required: true },
  paymentDetails: { cash: { type: Number, default: 0, min: 0 }, card: { type: Number, default: 0, min: 0 }, upi: { type: Number, default: 0, min: 0 }, other: { type: Number, default: 0, min: 0 } },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Refunded'], default: 'Paid' },
  notes: { type: String, trim: true },
  customerWasMember: { type: Boolean, default: false },
  membershipGrantedDuringBilling: { type: Boolean, default: false }
  
}, { timestamps: true });

// Pre-save middleware to generate invoice number (tenant-aware)
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const counterId = `invoice_counter_${this.tenantId}`;
    
    // <--- FIX 2: USE THE IMPORTED `Counter` VARIABLE DIRECTLY
    const counter = await Counter.findByIdAndUpdate(
      { _id: counterId }, // Use { _id: ... } for findByIdAndUpdate
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    this.invoiceNumber = `INV-${String(counter.seq).padStart(6, '0')}`;
  }
  next();
});

const Invoice = models.Invoice || model('Invoice', invoiceSchema);
export default Invoice;