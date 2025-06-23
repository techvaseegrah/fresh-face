  // models/invoice.ts
  import mongoose, { Schema, model, models } from 'mongoose';

  const lineItemSchema = new Schema({
    itemType: {
      type: String,
      enum: ['service', 'product'],
      required: true
    },
    itemId: { 
      type: Schema.Types.ObjectId,
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
    }
  }, { _id: false });

  const invoiceSchema = new Schema({
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
      type: Schema.Types.ObjectId,
      ref: 'Stylist',
      required: true
    },
    
    // ADD BILLING STAFF REFERENCE
    billingStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    
    // Items
    lineItems: [lineItemSchema],
    
    // Totals
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
    
    subtotal: {
      type: Number,
      required: true
    },
    
    membershipDiscount: {
      type: Number,
      default: 0
    },
    
    grandTotal: {
      type: Number,
      required: true
    },
    
    // SPLIT PAYMENT DETAILS
    paymentDetails: {
      cash: {
        type: Number,
        default: 0,
        min: 0
      },
      card: {
        type: Number,
        default: 0,
        min: 0
      },
      upi: {
        type: Number,
        default: 0,
        min: 0
      },
      other: {
        type: Number,
        default: 0,
        min: 0
      }
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
    
    // Membership info
    customerWasMember: {
      type: Boolean,
      default: false
    },
    
    membershipGrantedDuringBilling: {
      type: Boolean,
      default: false
    }
    
  }, { timestamps: true });

  // Pre-save middleware to generate invoice number
  invoiceSchema.pre('save', async function(next) {
    if (this.isNew && !this.invoiceNumber) {
      const count = await mongoose.model('Invoice').countDocuments();
      this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
    }
    next();
  });

  const Invoice = models.Invoice || model('Invoice', invoiceSchema);
  export default Invoice;
