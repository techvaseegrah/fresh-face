// src/models/ToolAudit.ts

import mongoose, { Document, Schema, Model } from 'mongoose';

// Defines the outcome of an audit for a single item.
type AuditItemStatus = 'MATCHED' | 'MISSING' | 'EXCESS';

/**
 * Sub-document interface for each line item within an audit report.
 */
interface IAuditItem {
  toolId: mongoose.Schema.Types.ObjectId;
  toolName: string; // Denormalized for historical accuracy.
  expectedCount: number;
  physicalCount: number;
  discrepancy: number;
  status: AuditItemStatus;
  remarks?: string;
}

/**
 * Interface representing a completed tool audit event.
 * This is a snapshot-in-time record of a physical stock count.
 */
export interface IToolAudit extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  auditorId: mongoose.Schema.Types.ObjectId; // The user who conducted the audit.
  auditDate: Date;
  items: IAuditItem[];
  createdAt: Date;
  updatedAt: Date;
}

// Schema for the sub-document. It will be embedded in the main ToolAudit schema.
const AuditItemSchema: Schema<IAuditItem> = new Schema({
  toolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tool', required: true },
  // We store the tool name at the time of audit. If the tool is renamed later,
  // this report remains historically accurate.
  toolName: { type: String, required: true },
  expectedCount: { type: Number, required: true },
  physicalCount: { type: Number, required: true },
  // The difference: physicalCount - expectedCount.
  discrepancy: { type: Number, required: true },
  status: { type: String, enum: ['MATCHED', 'MISSING', 'EXCESS'], required: true },
  remarks: { type: String, trim: true },
}, { _id: false }); // No separate _id for sub-documents unless needed.

const ToolAuditSchema: Schema<IToolAudit> = new Schema({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true,
    index: true
  },
  auditorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  auditDate: { 
    type: Date, 
    default: Date.now 
  },
  // An array containing the results for every tool checked during the audit.
  items: [AuditItemSchema],
}, { 
  timestamps: true 
});

const ToolAudit: Model<IToolAudit> = mongoose.models.ToolAudit || mongoose.model<IToolAudit>('ToolAudit', ToolAuditSchema);

export default ToolAudit;