import mongoose, { Document, Schema, Types } from 'mongoose';

// Interface for type safety
export interface ITool extends Document {
  tenantId: Types.ObjectId;
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
  tenantId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true,
    index: true 
  },
  name: { 
    type: String, 
    required: [true, 'Tool name is required.'],
    trim: true
  },
  category: { 
    type: String, 
    trim: true,
    default: 'General'
  },
  openingStock: { 
    type: Number, 
    required: true, 
    min: 0,
    default: 0 
  },
  // This will be updated by logs, but we store it for quick lookups.
  currentStock: { 
    type: Number, 
    required: true, 
    min: 0,
    default: 0 
  },
  maintenanceDueDate: { 
    type: Date 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
}, { 
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

// Create a compound index to ensure tool names are unique per tenant
ToolSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.Tool || mongoose.model<ITool>('Tool', ToolSchema);