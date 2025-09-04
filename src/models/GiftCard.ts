import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for TypeScript type safety
export interface IGiftCard extends Document {
  uniqueCode: string;
  giftCardTemplateId: mongoose.Schema.Types.ObjectId;
  customerId: mongoose.Schema.Types.ObjectId;
  initialBalance: number;
  currentBalance: number;
  issueDate: Date;
  expiryDate: Date;
  status: 'active' | 'redeemed' | 'expired';
  tenantId: mongoose.Schema.Types.ObjectId;
  issuedByStaffId: mongoose.Schema.Types.ObjectId;
  purchaseInvoiceId: mongoose.Schema.Types.ObjectId;
}

// Mongoose Schema
const GiftCardSchema: Schema = new Schema({
  uniqueCode: { 
    type: String, 
    required: true, 
    unique: true // Ensures every card number is unique
  },
  giftCardTemplateId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'GiftCardTemplate', 
    required: true 
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  initialBalance: { 
    type: Number, 
    required: true 
  },
  currentBalance: { 
    type: Number, 
    required: true 
  },
  issueDate: { 
    type: Date, 
    default: Date.now 
  },
  expiryDate: { 
    type: Date, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'redeemed', 'expired'], 
    default: 'active' 
  },
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true 
  },
  issuedByStaffId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Staff' // Assuming your staff are in the 'User' model
  },
  purchaseInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice' // Link to the original sale invoice
  }
}, { timestamps: true });

export const GiftCard: Model<IGiftCard> = 
  mongoose.models.GiftCard || mongoose.model<IGiftCard>('GiftCard', GiftCardSchema);