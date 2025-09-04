// src/models/Issue.ts

import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// Interface for a single checklist item
export interface IChecklistItem {
  questionText: string;
  responseType: 'yes_no' | 'yes_no_remarks';
  mediaUpload: 'none' | 'optional' | 'required';
}

// Interface for the Issue document (UPDATED)
export interface IIssue extends Document {
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  type: 'daily' | 'weekly' | 'monthly' | 'one_time';
  roles: Types.ObjectId[];
  checklistItems: IChecklistItem[];
  fileUrl?: string;
  tenantId: Types.ObjectId;
  
  // ✅ FIX: These two fields now work together to identify any creator
  createdBy: Types.ObjectId;
  createdByType: 'User' | 'Staff'; // This new field is the key

  isActive: boolean;
}

const checklistItemSchema: Schema<IChecklistItem> = new Schema({
  questionText: { type: String, required: true, trim: true },
  responseType: { type: String, enum: ['yes_no', 'yes_no_remarks'], default: 'yes_no' },
  mediaUpload: { type: String, enum: ['none', 'optional', 'required'], default: 'none' },
});

const issueSchema: Schema<IIssue> = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  priority: { type: String, enum: ['high', 'medium', 'low', 'none'], default: 'medium' },
  type: { type: String, enum: ['daily', 'weekly', 'monthly', 'one_time'], default: 'daily' },
  roles: [{ type: Schema.Types.ObjectId, ref: 'Role', required: true }],
  checklistItems: [checklistItemSchema],
  fileUrl: { type: String },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  // ✅ FIX: This tells Mongoose to use the `createdByType` field to decide
  // whether to look in the 'User' collection or the 'Staff' collection.
  createdBy: { type: Schema.Types.ObjectId, required: true, refPath: 'createdByType' },
  createdByType: { type: String, required: true, enum: ['User', 'Staff'] },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Issue: Model<IIssue> = mongoose.models.Issue || mongoose.model<IIssue>('Issue', issueSchema);

export default Issue;