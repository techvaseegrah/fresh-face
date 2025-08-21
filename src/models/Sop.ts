import mongoose, { Document, Schema, Model } from 'mongoose';

// Ensure you have Role model imported if you want to use mongoose.Types.ObjectId from it
// import { IRole } from './role'; 

export interface ISop extends Document {
  title: string;
  description: string;
  content: string; // For rich-text steps, images, video embeds
  type: 'document' | 'checklist';
  checklistItems: { text: string }[];
  roles: mongoose.Schema.Types.ObjectId[]; // Links to your existing Role model
  tenantId: mongoose.Schema.Types.ObjectId;
  createdBy: mongoose.Schema.Types.ObjectId;
  isActive: boolean;
}

const SopSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: false },
  content: { type: String, required: false },
  type: { type: String, enum: ['document', 'checklist'], required: true, default: 'document' },
  checklistItems: [{ text: { type: String, required: true } }],
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Sop: Model<ISop> = mongoose.models.Sop || mongoose.model<ISop>('Sop', SopSchema);

export default Sop;