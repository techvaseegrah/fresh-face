import mongoose, { Schema, model, models, Document } from 'mongoose';
import Counter from './Counter'; // Ensure this Counter model exists and is correct

// --- INTERFACES ---
interface ILineItem {
  tenantId: mongoose.Schema.Types.ObjectId; // CORRECTED TYPE
  itemType: 'service' | 'product' | 'fee';
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  membershipRate?: number;
  finalPrice: number;
  membershipDiscount?: number;
  staffId: mongoose.Schema.Types.ObjectId;
}

export interface IInvoice extends Document {
  tenantId: mongoose.Schema.Types.ObjectId; // CORRECTED TYPE
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
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  notes?: string;
  customerWasMember: boolean;
  membershipGrantedDuringBilling: boolean;
}

// --- SUB-SCHEMA for each item in the invoice ---
const lineItemSchema = new Schema<ILineItem>({
  // --- FIX 1: Correct the data type for tenantId ---
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  
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


// --- MAIN SCHEMA for the entire invoice ---
const invoiceSchema = new Schema<IInvoice>({
  // --- FIX 2: Correct the main data type for tenantId ---
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
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Refunded'], default: 'Paid' },
  notes: { type: String, trim: true },
  customerWasMember: { type: Boolean, default: false },
  membershipGrantedDuringBilling: { type: Boolean, default: false }
}, { timestamps: true });


// --- This part remains the same and is correct ---
invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true, sparse: true });

invoiceSchema.pre('save', async function(next) {
    if (this.isNew && !this.invoiceNumber) {
        // --- FIX 3: Ensure the counter ID is a string, which it already is ---
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