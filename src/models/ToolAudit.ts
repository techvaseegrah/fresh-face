import mongoose, { Document, Schema, Types } from 'mongoose';

// This is a sub-document schema, not a model itself.
const AuditItemSchema: Schema = new Schema({
  toolId: { type: Schema.Types.ObjectId, ref: 'Tool', required: true },
  toolName: { type: String, required: true }, // Denormalized for easier reporting
  expectedStock: { type: Number, required: true },
  countedStock: { type: Number, required: true },
  discrepancy: { type: Number, required: true }, // = countedStock - expectedStock
  status: { type: String, enum: ['MATCHED', 'MISMATCHED'], required: true },
  remarks: { type: String }
}, { _id: false });

export interface IToolAudit extends Document {
  tenantId: Types.ObjectId;
  auditorId: Types.ObjectId;
  auditorName: string; // Denormalized for easier reporting
  status: 'COMPLETED';
  items: {
    toolId: Types.ObjectId;
    toolName: string;
    expectedStock: number;
    countedStock: number;
    discrepancy: number;
    status: 'MATCHED' | 'MISMATCHED';
    remarks?: string;
  }[];
  createdAt: Date;
}

const ToolAuditSchema: Schema<IToolAudit> = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  auditorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  auditorName: { type: String, required: true },
  status: { type: String, enum: ['COMPLETED'], default: 'COMPLETED' },
  items: [AuditItemSchema]
}, { 
  timestamps: { createdAt: true, updatedAt: false } 
});

export default mongoose.models.ToolAudit || mongoose.model<IToolAudit>('ToolAudit', ToolAuditSchema);