import mongoose, { Document, Schema, Model } from 'mongoose';

// --- NEW ---: Define a sub-schema for individual checklist items.
// This creates a structured "question" with all its configuration.
const ChecklistItemSchema = new Schema({
  questionText: {
    type: String,
    required: true,
    trim: true,
  },
  responseType: {
    type: String,
    enum: ['yes_no', 'yes_no_remarks'],
    required: true,
    default: 'yes_no',
  },
  mediaUpload: {
    type: String,
    enum: ['none', 'optional', 'required'],
    required: true,
    default: 'none',
  },
});

// --- UPDATED ---: The main ISop interface now uses the new checklist item structure.
export interface ISop extends Document {
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  
  // The checklistItems array now holds more complex objects.
  checklistItems: {
    _id: mongoose.Types.ObjectId; // Each item will have its own unique ID
    questionText: string;
    responseType: 'yes_no' | 'yes_no_remarks';
    mediaUpload: 'none' | 'optional' | 'required';
  }[];

  roles: mongoose.Schema.Types.ObjectId[];
  tenantId: mongoose.Schema.Types.ObjectId;
  createdBy: mongoose.Schema.Types.ObjectId;
  isActive: boolean;
}

const SopSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: false },
  
  type: { 
    type: String, 
    enum: ['daily', 'weekly', 'monthly'],
    required: true, 
    default: 'daily'
  },

  // --- UPDATED ---: The schema now uses the ChecklistItemSchema for the array.
  checklistItems: [ChecklistItemSchema],

  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// To prevent Mongoose from recompiling the model on every hot-reload
const Sop: Model<ISop> = mongoose.models.Sop || mongoose.model<ISop>('Sop', SopSchema);

export default Sop;