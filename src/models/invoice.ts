import mongoose, { Schema, model, models } from 'mongoose';

// ===================================================================================
//  SUBDOCUMENT SCHEMA: LineItem
// ===================================================================================
const lineItemSchema = new Schema({
  itemType: {
    type: String,
    enum: ['service', 'product', 'membership'],
    required: true
  },
  itemId: { 
    type: Schema.Types.ObjectId,
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
  finalPrice: {
    type: Number,
    required: true
  },
}, { _id: false });


// ===================================================================================
//  MAIN INVOICE SCHEMA
// ===================================================================================
const invoiceSchema = new Schema({
  invoiceNumber: { 
    type: String,
    unique: true,
    sparse: true,
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  appointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment',
    index: true,
    sparse: true
  },
  // ===> ADDED STYLIST INFORMATION <===
  stylistId: {
    type: Schema.Types.ObjectId,
    ref: 'Stylist',
    required: true
  },
  stylistName: {
    type: String,
    required: true
  },
  
  lineItems: [lineItemSchema],

  // --- Financials ---
  subTotal: {
    type: Number,
    required: true
  },
  serviceTotal: {
      type: Number,
      required: true,
      default: 0
  },
  productTotal: {
      type: Number,
      required: true,
      default: 0
  },
  grandTotal: {
    type: Number,
    required: true
  },

  // --- Payment ---
  paymentMethod: {
    type: String,
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Refunded'],
    default: 'Paid'
  },
  notes: {
    type: String,
    trim: true
  },
  
  // --- Related Documents ---
  purchasedMembershipId: {
    type: Schema.Types.ObjectId,
    ref: 'CustomerMembership',
    sparse: true
  },
}, { 
  timestamps: true 
});

const Invoice = models.Invoice || model('Invoice', invoiceSchema);

export default Invoice;