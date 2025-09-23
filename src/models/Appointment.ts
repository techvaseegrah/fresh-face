// /models/Appointment.ts - THE CORRECT AND FINAL VERSION

import mongoose, { Schema, model, models } from 'mongoose';
import './staff'; 
import './ServiceItem';
import './customermodel';
import './user'; // Make sure the User model is imported for the ref
import './CustomerPackage';
import './Product'

const RedeemedItemSchema = new Schema({
  customerPackageId: { 
    type: Schema.Types.ObjectId, 
    ref: 'CustomerPackage', 
    required: true 
  },
  redeemedItemId: { 
    type: Schema.Types.ObjectId, 
    required: true 
    // We don't need a ref here as the itemType tells us which model to look in
  },
  redeemedItemType: { 
    type: String, 
    enum: ['service', 'product'], 
    required: true 
  },
}, { _id: false });

const appointmentSchema = new Schema({
  tenantId: { 
    type: require('mongoose').Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  
  serviceIds: [{ 
    type: Schema.Types.ObjectId,
    ref: 'ServiceItem',
    required: [true, 'At least one service is required.']
  }],
  
  productIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Product'
  }],
  stylistId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Staff',
    required: true,
    index: true
  },
  
  billingStaffId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  
  appointmentType: {
    type: String,
    enum: ['Online', 'Offline','Telecalling'],
    required: true,
    default: 'Online'
  },
  
  status: {
    type: String,
    enum: ['Appointment', 'Checked-In', 'Checked-Out', 'Paid', 'Cancelled', 'No-Show'],
    default: 'Appointment'
  },
  
  // === THIS IS THE SINGLE MOST IMPORTANT CHANGE ===
  // We use a SINGLE, REQUIRED field for the appointment's date and time.
  appointmentDateTime: { type: Date, required: true },

  // The old, separate, and problematic fields have been REMOVED.
  // appointmentTime: { type: Date, required: true },  <-- REMOVED
  // date: { type: Date, required: true },             <-- REMOVED
  // time: { type: String, required: true },           <-- REMOVED
  // ===============================================
  
  // These event timestamps are good to keep
  checkInTime: { type: Date, sparse: true },
  checkOutTime: { type: Date, sparse: true },
  
  notes: { type: String },
  
  // Billing and Duration info remains the same
  amount: { type: Number, default: 0, min: 0 },
  membershipDiscount: { type: Number, default: 0, min: 0 },
  finalAmount: { type: Number, default: 0, min: 0 },
  paymentDetails: {
    cash: { type: Number, default: 0, min: 0 },
    card: { type: Number, default: 0, min: 0 },
    upi: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 }
  },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', sparse: true },
  estimatedDuration: { type: Number, required: true },
  actualDuration: { type: Number, sparse: true },
   redeemedItems: {
    type: [RedeemedItemSchema],
    default: undefined, // Ensures the field is not created if empty
  },
  
}, { timestamps: true });

// Method to calculate appointment total remains the same
appointmentSchema.methods.calculateTotal = async function() {
  // FIX #1: Populate services, products, AND the customer in one go.
  await this.populate(['serviceIds', 'productIds', 'customerId']);
  
  let serviceTotal = 0;
  let productTotal = 0; // Variable to hold the total for products
  let membershipSavings = 0;

  const isCustomerMember = this.customerId?.isMembership || false;
  
  // --- Calculate for Services ---
  if (this.serviceIds && this.serviceIds.length > 0) {
    for (const service of this.serviceIds) {
      const hasDiscount = isCustomerMember && service.membershipRate;
      
      const price = hasDiscount ? service.membershipRate : service.price;
      serviceTotal += price;
      
      if (hasDiscount) {
        membershipSavings += (service.price - service.membershipRate);
      }
    }
  }

  // ================================================================
  // FIX #2: Add this new block to calculate the total for products
  // ================================================================
  if (this.productIds && this.productIds.length > 0) {
    for (const product of this.productIds) {
      // Assuming products can also have a membershipRate. If not, you can simplify this.
      const hasDiscount = isCustomerMember && product.membershipRate;
      
      const price = hasDiscount ? product.membershipRate : product.price;
      productTotal += price;
      
      if (hasDiscount) {
        membershipSavings += (product.price - product.membershipRate);
      }
    }
  }
  
  // FIX #3: The grand total is now the sum of services AND products
  const grandTotal = serviceTotal + productTotal;
  
  return {
    serviceTotal,
    productTotal,
    membershipSavings,
    grandTotal,
    originalTotal: grandTotal + membershipSavings // The total before any discounts
  };
};


// Update indexes to use the new, correct field
appointmentSchema.index({ stylistId: 1, appointmentDateTime: 1 });
appointmentSchema.index({ customerId: 1, appointmentDateTime: -1 });
appointmentSchema.index({ status: 1, appointmentType: 1 });

const Appointment = models.Appointment || model('Appointment', appointmentSchema);
export default Appointment;