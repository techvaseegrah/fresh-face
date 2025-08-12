// /models/invoice.ts - CORRECTED VERSION

import mongoose, { Schema, model, models } from 'mongoose';

// --- This is the sub-schema for each item in the invoice ---
const lineItemSchema = new Schema({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
  },
  itemType: {
    type: String,
    enum: ['service', 'product','fee'],
    required: true
  },
  itemId: { 
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  membershipRate: {
    type: Number,
    sparse: true
  },
  finalPrice: {
    type: Number,
    required: true
  },
  membershipDiscount: { 
    type: Number,
    default: 0
  },
  // ==========================================================
  // === THE FIX IS HERE: Add the staffId to the line item ====
  // ==========================================================
  staffId: {
    type: Schema.Types.ObjectId,
    ref: 'Staff', // Make sure this ref matches your staff model name
    required: [true, 'A staff member must be assigned to each line item.'], // Make it required for data integrity
    index: true
  },
  // ==========================================================
}, { _id: false });


// --- This is the main schema for the entire invoice ---
const invoiceSchema = new Schema({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  invoiceNumber: { 
    type: String,
    unique: true,
    sparse: true,
  },
  appointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    index: true
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  stylistId: {
    // This can still represent the main stylist for the appointment
    type: Schema.Types.ObjectId,
    ref: 'Staff', // Changed from 'Stylist' to 'Staff' for consistency
    required: true
  },
  billingStaffId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lineItems: [lineItemSchema], // This now uses the corrected sub-schema
  
  serviceTotal: { type: Number, required: true, default: 0 },
  productTotal: { type: Number, required: true, default: 0 },
  subtotal: { type: Number, required: true },
  membershipDiscount: { type: Number, default: 0 },
  manualDiscount: {
    type: { type: String, enum: ['fixed', 'percentage', null], default: null },
    value: { type: Number, default: 0 },
    appliedAmount: { type: Number, default: 0 }
  },
  grandTotal: { type: Number, required: true },
  paymentDetails: {
    cash: { type: Number, default: 0, min: 0 },
    card: { type: Number, default: 0, min: 0 },
    upi: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 }
  },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Refunded'], default: 'Paid' },
  notes: { type: String, trim: true },
  customerWasMember: { type: Boolean, default: false },
  membershipGrantedDuringBilling: { type: Boolean, default: false }
  
}, { timestamps: true });

// Pre-save middleware to generate invoice number (tenant-aware)
  invoiceSchema.pre('save', async function(next) {
    if (this.isNew && !this.invoiceNumber) {
      const counterId = `invoice_counter_${this.tenantId}`;
      
      // This operation is "atomic", meaning it's guaranteed to be safe from race conditions
      const counter = await mongoose.model('Counter').findByIdAndUpdate(
        counterId,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      
      this.invoiceNumber = `INV-${String(counter.seq).padStart(6, '0')}`;
    }
    next();
  });

const Invoice = models.Invoice || model('Invoice', invoiceSchema);
export default Invoice;