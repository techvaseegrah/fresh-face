import mongoose, { Schema, model, models, Document } from 'mongoose';
import Counter from './Counter';

// --- INTERFACES ---
interface ILineItem {
  tenantId: mongoose.Schema.Types.ObjectId;
  // --- MODIFICATION: Add 'gift_card' to the allowed item types ---
  itemType: 'service' | 'product' | 'fee' | 'gift_card';
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  membershipRate?: number;
  finalPrice: number;
  membershipDiscount?: number;
  // --- MODIFICATION: Make staffId optional for gift cards ---
  staffId?: mongoose.Schema.Types.ObjectId;
}

export interface IInvoice extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  invoiceNumber: string;
  appointmentId: mongoose.Schema.Types.ObjectId;
  customerId: mongoose.Schema.Types.ObjectId;
  stylistId: mongoose.Schema.Types.ObjectId;
  billingStaffId: mongoose.Schema.Types.ObjectId;
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
  // --- MODIFICATION: Add optional giftCardPayment property ---
  giftCardPayment?: {
    cardId: mongoose.Schema.Types.ObjectId;
    amount: number;
  };
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  notes?: string;
  customerWasMember: boolean;
  membershipGrantedDuringBilling: boolean;
}

// --- SUB-SCHEMA for each item in the invoice ---
const lineItemSchema = new Schema<ILineItem>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  
  // --- MODIFICATION: Add 'gift_card' to the enum validator ---
  itemType: { type: String, enum: ['service', 'product', 'fee', 'gift_card'], required: true },
  
  itemId: { type: String, required: true }, 
  name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  membershipRate: { type: Number, sparse: true }, 
  finalPrice: { type: Number, required: true },
  membershipDiscount: { type: Number, default: 0 },
  
  // --- MODIFICATION: Make staffId not required ---
  // A staff member is not required for a gift card sale.
  // The validation should be handled in the API logic before saving.
  staffId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
}, { _id: false });


// --- MAIN SCHEMA for the entire invoice ---
const invoiceSchema = new Schema<IInvoice>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  invoiceNumber: { type: String }, 
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  stylistId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  billingStaffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
  // --- MODIFICATION: Add giftCardPayment to the schema ---
  giftCardPayment: {
    cardId: { type: Schema.Types.ObjectId, ref: 'GiftCard' },
    amount: { type: Number },
  },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Refunded'], default: 'Paid' },
  notes: { type: String, trim: true },
  customerWasMember: { type: Boolean, default: false },
  membershipGrantedDuringBilling: { type: Boolean, default: false }
}, { timestamps: true });


// --- This part remains the same ---
invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true, sparse: true });

invoiceSchema.pre('save', async function(next) {
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