import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISop extends Document {
  title: string;
  description: string;
  // --- REMOVED --- content is no longer used in the new checklist-only system
  // content: string; 
  
  // --- CHANGED --- Updated the allowed types for TypeScript
  type: 'daily' | 'weekly' | 'monthly';
  
  checklistItems: { text: string }[];
  roles: mongoose.Schema.Types.ObjectId[];
  tenantId: mongoose.Schema.Types.ObjectId;
  createdBy: mongoose.Schema.Types.ObjectId;
  isActive: boolean;
}

const SopSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: false },
  
  // --- REMOVED --- The content field is no longer needed
  // content: { type: String, required: false },

  // --- CHANGED --- Updated the enum and default value
  type: { 
    type: String, 
    enum: ['daily', 'weekly', 'monthly'], // These are the only allowed values now
    required: true, 
    default: 'daily' // Set a new, valid default
  },

  checklistItems: [{ text: { type: String, required: true } }],
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// To prevent Mongoose from recompiling the model on every hot-reload
const Sop: Model<ISop> = mongoose.models.Sop || mongoose.model<ISop>('Sop', SopSchema);

export default Sop;