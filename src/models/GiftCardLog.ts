import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for TypeScript type safety
export interface IGiftCardLog extends Document {
  giftCardId: mongoose.Schema.Types.ObjectId;
  invoiceId: mongoose.Schema.Types.ObjectId;
  customerId: mongoose.Schema.Types.ObjectId;
  amountRedeemed: number;
  balanceBefore: number;
  balanceAfter: number;
  tenantId: mongoose.Schema.Types.ObjectId;
}

// Mongoose Schema
const GiftCardLogSchema: Schema = new Schema({
  giftCardId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'GiftCard', 
    required: true 
  },
  invoiceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Invoice', 
    required: true 
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  amountRedeemed: { 
    type: Number, 
    required: true 
  },
  balanceBefore: { 
    type: Number, 
    required: true 
  },
  balanceAfter: { 
    type: Number, 
    required: true 
  },
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true 
  },
}, { timestamps: true });

export const GiftCardLog: Model<IGiftCardLog> = 
  mongoose.models.GiftCardLog || mongoose.model<IGiftCardLog>('GiftCardLog', GiftCardLogSchema);