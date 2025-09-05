// src/models/Tool.ts

import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Interface representing a single tool in the inventory.
 * This is the master record for each piece of reusable equipment.
 */
export interface ITool extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  name: string;
  category: string;
  openingStock: number;
  currentStock: number;
  maintenanceDueDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ToolSchema: Schema<ITool> = new Schema({
  // The tenant this tool belongs to. Crucial for multi-tenancy.
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true,
    index: true // Index for faster queries filtered by tenant.
  },
  // The name of the tool (e.g., "Premium Cutting Scissors", "Wahl Magic Clip").
  name: { 
    type: String, 
    required: [true, 'Tool name is required.'], 
    trim: true 
  },
  // A category for grouping tools (e.g., "Cutting", "Electrical", "Styling").
  category: { 
    type: String, 
    required: [true, 'Tool category is required.'], 
    trim: true 
  },
  // The initial quantity of the tool when it was first added.
  openingStock: { 
    type: Number, 
    required: true, 
    default: 0,
    min: [0, 'Stock cannot be negative.']
  },
  // The current, real-time quantity available. This value will be updated by stock adjustments.
  currentStock: { 
    type: Number, 
    required: true, 
    default: 0,
    min: [0, 'Stock cannot be negative.']
  },
  // Optional: A date to track when the tool needs servicing or replacement.
  maintenanceDueDate: { 
    type: Date 
  },
  // A soft-delete flag. Instead of deleting tools, we deactivate them to preserve history.
  isActive: { 
    type: Boolean, 
    default: true 
  },
}, { 
  // Automatically add createdAt and updatedAt timestamps.
  timestamps: true 
});

// To prevent model recompilation on hot reloads in Next.js
const Tool: Model<ITool> = mongoose.models.Tool || mongoose.model<ITool>('Tool', ToolSchema);

export default Tool;