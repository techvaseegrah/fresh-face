import mongoose, { Schema, model, models, Document } from 'mongoose';
import Counter from './Counter';

// --- INTERFACES (No changes needed, but included for completeness) ---
interface ILineItem {
  tenantId: mongoose.Schema.Types.ObjectId;
  itemType: 'service' | 'product' | 'fee' | 'gift_card' | 'package';
  // Note: For imported items, itemId and staffId can be null/undefined.
  itemId?: string; 
  name: string;
  quantity: number;
  unitPrice: number;
  membershipRate?: number;
  finalPrice: number;
  membershipDiscount?: number;
  staffId?: mongoose.Schema.Types.ObjectId;
  // This field will hold the staff name for imported invoices
  staffName?: string;
}

export interface IInvoice extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  invoiceNumber: string;
  appointmentId?: mongoose.Schema.Types.ObjectId | null;
  customerId: mongoose.Schema.Types.ObjectId;
  stylistId?: mongoose.Schema.Types.ObjectId; // Made optional for imported
  billingStaffId?: mongoose.Schema.Types.ObjectId; // Made optional for imported
  lineItems: ILineItem[];
  serviceTotal: number;
  productTotal: number;
  subtotal: number;
  membershipDiscount: number;
  manualDiscount: {
    type: 'fixed' | 'percentage' | null;
    value: number;
    appliedAmount: number;
  };
  grandTotal: number;
  paymentDetails: {
    cash: number;
    card: number;
    upi: number;
    other: number;
  };
  giftCardPayment?: {
    cardId: mongoose.Schema.Types.ObjectId;
    amount: number;
  };
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  notes?: string;
  customerWasMember: boolean;
  membershipGrantedDuringBilling: boolean;
  isImported?: boolean;
}

// --- SUB-SCHEMA for each item in the invoice ---
const lineItemSchema = new Schema<ILineItem>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  itemType: { type: String, enum: ['service', 'product', 'fee', 'gift_card', 'package'], required: true },
  
  // --- CHANGE #1: Make itemId conditionally required ---
  itemId: { 
    type: String,
    // This field is required ONLY IF the parent invoice's isImported flag is NOT true.
    required: function(this: any) { 
      const parent = this.parent();
      return !parent.isImported; 
    }
  },
  
  name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  membershipRate: { type: Number, sparse: true }, 
  finalPrice: { type: Number, required: true },
  membershipDiscount: { type: Number, default: 0 },
  
  // --- CHANGE #2: Make staffId conditionally required ---
  staffId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    // Required only for non-imported invoices.
    required: function(this: any) {
      const parent = this.parent();
      return !parent.isImported; 
    }
  },

  // --- NEW FIELD: Added to store the staff name for imported invoices ---
  staffName: { type: String },

}, { _id: false });


// --- MAIN SCHEMA for the entire invoice ---
const invoiceSchema = new Schema<IInvoice>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  invoiceNumber: { type: String }, 
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: false, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },

  // --- CHANGE #3: Make stylistId conditionally required ---
  stylistId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Staff', 
    // In the main document, `this` refers to the invoice itself.
    required: function(this: IInvoice) { return !this.isImported; }
  },
  
  // --- CHANGE #4: Make billingStaffId conditionally required ---
  billingStaffId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: function(this: IInvoice) { return !this.isImported; }
  },

  lineItems: [lineItemSchema],
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
  giftCardPayment: {
    cardId: { type: Schema.Types.ObjectId, ref: 'GiftCard' },
    amount: { type: Number },
  },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Refunded'], default: 'Paid' },
  notes: { type: String, trim: true },
  customerWasMember: { type: Boolean, default: false },
  membershipGrantedDuringBilling: { type: Boolean, default: false },
  isImported: { 
      type: Boolean, 
      default: false 
    },
}, { timestamps: true });


// --- This part remains the same ---
invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true, sparse: true });

invoiceSchema.pre('save', async function(this: IInvoice, next) {
    if (this.isNew && !this.invoiceNumber) {
        const counterId = `invoice_counter_${this.tenantId.toString()}`;
        
        const counter = await Counter.findByIdAndUpdate(
            counterId,
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        
        this.invoiceNumber = `INV-${String(counter.seq).padStart(6, '0')}`;
    }
    next();
});

const Invoice = models.Invoice || model<IInvoice>('Invoice', invoiceSchema);
export default Invoice;