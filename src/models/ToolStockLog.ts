// src/models/ToolStockLog.ts

import mongoose, { Document, Schema, Model } from 'mongoose';

// Defines the types of stock changes for clarity and consistency.
type ChangeType = 'INITIAL_STOCK' | 'ADDITION' | 'DAMAGE' | 'LOSS' | 'DELETION';

/**
 * Interface for an immutable log entry that records every change to a tool's stock.
 * This provides a full, traceable audit trail.
 */
export interface IToolStockLog extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  toolId: mongoose.Schema.Types.ObjectId;
  userId: mongoose.Schema.Types.ObjectId; // The user who made the change.
  changeType: ChangeType;
  quantityChange: number; // Can be positive (e.g., +2) or negative (e.g., -1).
  stockBefore: number;
  stockAfter: number;
  remarks?: string;
  createdAt: Date;
}

const ToolStockLogSchema: Schema<IToolStockLog> = new Schema({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true,
    index: true
  },
  // Links this log entry to a specific tool.
  toolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tool', 
    required: true,
    index: true 
  },
  // Tracks which user performed the action. Essential for accountability.
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // The reason for the stock change.
  changeType: { 
    type: String, 
    enum: ['INITIAL_STOCK', 'ADDITION', 'DAMAGE', 'LOSS', 'DELETION'],
    required: true
  },
  // The amount the stock changed by.
  quantityChange: { 
    type: Number, 
    required: true 
  },
  // The stock count before this transaction occurred.
  stockBefore: {
    type: Number,
    required: true
  },
  // The stock count after this transaction. (stockBefore + quantityChange)
  stockAfter: {
    type: Number,
    required: true
  },
  // Optional notes explaining the change (e.g., "Dropped by stylist", "New purchase order #123").
  remarks: { 
    type: String, 
    trim: true 
  },
}, { 
  timestamps: { createdAt: true, updatedAt: false } // We only care about when the log was created.
});

const ToolStockLog: Model<IToolStockLog> = mongoose.models.ToolStockLog || mongoose.model<IToolStockLog>('ToolStockLog', ToolStockLogSchema);

export default ToolStockLog;