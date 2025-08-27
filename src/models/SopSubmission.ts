import mongoose, { Document, Schema, Model } from 'mongoose';
import { ISop } from './Sop'; // Import the ISop interface to reference its sub-document

// Define the possible statuses as a TypeScript type for better code safety
export type SubmissionStatus = 'pending_review' | 'approved' | 'rejected';

// --- NEW ---: Define a sub-schema for a single, detailed response.
const ResponseSchema = new Schema({
  // This is the crucial link back to the specific question in the Sop model.
  checklistItem: { 
    type: Schema.Types.ObjectId, 
    ref: 'Sop.checklistItems', // This ref path is conceptual; Mongoose doesn't enforce it for sub-docs
    required: true 
  },
  // The user's answer (yes or no)
  answer: { 
    type: String,
    enum: ['yes', 'no', ''], // Allow empty string if not answered
    required: true,
  },
  // The optional text remarks from the user
  remarks: { 
    type: String,
    trim: true,
  },
  // The optional media URL (image or video)
  mediaUrl: { 
    type: String 
  },
});

// --- UPDATED ---: The main ISopSubmission interface now uses the new response structure.
export interface ISopSubmission extends Document {
  sop: mongoose.Schema.Types.ObjectId;
  staff: mongoose.Schema.Types.ObjectId;
  tenantId: mongoose.Schema.Types.ObjectId;
  submissionDate: Date;

  // The responses array now holds more complex answer objects.
  responses: {
    checklistItem: mongoose.Types.ObjectId;
    answer: 'yes' | 'no' | '';
    remarks?: string;
    mediaUrl?: string;
  }[];

  status: SubmissionStatus;
  reviewNotes?: string;
  reviewedBy?: mongoose.Schema.Types.ObjectId;
}

const SopSubmissionSchema: Schema = new Schema({
  sop: { type: mongoose.Schema.Types.ObjectId, ref: 'Sop', required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  submissionDate: { type: Date, required: true },

  // --- UPDATED ---: The schema now uses the ResponseSchema for the array.
  responses: [ResponseSchema],

  status: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected'],
    default: 'pending_review',
    required: true,
  },
  reviewNotes: {
    type: String,
    required: false,
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

}, { timestamps: true });

// This index ensures a user can only submit a specific SOP once per day.
SopSubmissionSchema.index({ sop: 1, staff: 1, submissionDate: 1 }, { unique: true });

const SopSubmission: Model<ISopSubmission> = mongoose.models.SopSubmission || mongoose.model<ISopSubmission>('SopSubmission', SopSubmissionSchema);

export default SopSubmission;