import mongoose, { Document, Schema, Types } from 'mongoose';

export type ToolLogAction = 'OPENING_STOCK' | 'ADDITION' | 'DAMAGE' | 'LOSS' | 'DELETION' | 'AUDIT_ADJUSTMENT';

export interface IToolLog extends Document {
  tenantId: Types.ObjectId;
  toolId: Types.ObjectId;
  userId: Types.ObjectId;
  action: ToolLogAction;
  quantityChange: number; // e.g., +5 for addition, -1 for damage
  stockBefore: number;
  stockAfter: number;
  remarks?: string;
  createdAt: Date;
}

const ToolLogSchema: Schema<IToolLog> = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  toolId: { type: Schema.Types.ObjectId, ref: 'Tool', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { 
    type: String, 
    required: true, 
    enum: ['OPENING_STOCK', 'ADDITION', 'DAMAGE', 'LOSS', 'DELETION', 'AUDIT_ADJUSTMENT'] 
  },
  quantityChange: { type: Number, required: true },
  stockBefore: { type: Number, required: true },
  stockAfter: { type: Number, required: true },
  remarks: { type: String, trim: true },
}, {
  timestamps: { createdAt: true, updatedAt: false } // Only createdAt is relevant for a log
});

export default mongoose.models.ToolLog || mongoose.model<IToolLog>('ToolLog', ToolLogSchema);