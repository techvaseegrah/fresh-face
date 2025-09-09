// src/models/IssueSubmission.ts

import mongoose, { Document, Model, Schema } from 'mongoose';

// Interface for a single response in a submission (UPDATED)
export interface IResponse extends Document {
  checklistItem: mongoose.Schema.Types.ObjectId;
  answer: 'yes' | 'no' | '';
  remarks?: string;
  mediaUrl?: string; // For media attached to a specific question
}

export interface IIssueSubmission extends Document {
  issue: mongoose.Schema.Types.ObjectId;
  staff: mongoose.Schema.Types.ObjectId;
  tenantId: mongoose.Schema.Types.ObjectId;
  submissionDate: Date;
  status: 'pending_review' | 'approved' | 'rejected';
  responses: IResponse[];
  // ✅ FIX: These two fields allow the reviewer to be either a User or a Staff
  reviewedBy?: mongoose.Schema.Types.ObjectId;
  reviewedByType?: 'User' | 'Staff'; // This new field is the key
  reviewNotes?: string;
}

// --- UPDATED: Schema for a single response ---
const responseSchema: Schema<IResponse> = new Schema({
  checklistItem: { type: Schema.Types.ObjectId, required: true },
  answer: { type: String, enum: ['yes', 'no', ''], required: true },
  remarks: { type: String, trim: true },
  mediaUrl: { type: String },
});

const issueSubmissionSchema: Schema<IIssueSubmission> = new Schema({
  issue: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
  staff: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  submissionDate: { type: Date, required: true },
  status: { type: String, enum: ['pending_review', 'approved', 'rejected'], default: 'pending_review' },
  responses: [responseSchema],
  // ✅ FIX: This tells Mongoose to use `reviewedByType` to find the reviewer
  // in either the 'User' or 'Staff' collection.
  reviewedBy: { type: Schema.Types.ObjectId, refPath: 'reviewedByType' },
  reviewedByType: { type: String, enum: ['User', 'Staff'] },
  reviewNotes: { type: String, trim: true },
}, { timestamps: true });

const IssueSubmission: Model<IIssueSubmission> = mongoose.models.IssueSubmission || mongoose.model<IIssueSubmission>('IssueSubmission', issueSubmissionSchema);

export default IssueSubmission;