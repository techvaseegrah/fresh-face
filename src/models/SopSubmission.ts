import mongoose, { Document, Schema, Model } from 'mongoose';

// Define the possible statuses as a TypeScript type for better code safety and autocompletion
export type SubmissionStatus = 'pending_review' | 'approved' | 'rejected';

export interface ISopSubmission extends Document {
  sop: mongoose.Schema.Types.ObjectId;
  staff: mongoose.Schema.Types.ObjectId;
  tenantId: mongoose.Schema.Types.ObjectId;
  submissionDate: Date;
  responses: {
    text: string;
    checked: boolean;
    mediaUrl?: string; // Correctly named for video or image
  }[];
  createdAt: Date;

  // New fields for the approval workflow
  status: SubmissionStatus;
  reviewNotes?: string; // Optional field for manager's feedback on rejection
  reviewedBy?: mongoose.Schema.Types.ObjectId;
}

const SopSubmissionSchema: Schema = new Schema({
  sop: { type: mongoose.Schema.Types.ObjectId, ref: 'Sop', required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  submissionDate: { type: Date, required: true },
  responses: [{
    text: { type: String, required: true },
    checked: { type: Boolean, required: true },
    // --- CORRECTED ---: Renamed 'imageUrl' to the more generic 'mediaUrl'
    mediaUrl: { type: String, required: false }
  }],

  // --- NEW WORKFLOW FIELDS ---
  // Replaced 'isReviewed' boolean with a more flexible 'status' string
  status: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected'], // These are the only allowed values
    default: 'pending_review', // New submissions will automatically get this status
    required: true,
  },
  // Added a new field for manager's notes on rejection
  reviewNotes: {
    type: String,
    required: false,
  },
  
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

}, { timestamps: true }); // Enable both createdAt and updatedAt

// This index ensures a user can only submit a specific SOP once per day.
// You might need to adjust or temporarily remove this if your re-submission logic
// involves creating a new document. A better approach for re-submission would be to
// update the existing 'rejected' document.
SopSubmissionSchema.index({ sop: 1, staff: 1, submissionDate: 1 }, { unique: true });

const SopSubmission: Model<ISopSubmission> = mongoose.models.SopSubmission || mongoose.model<ISopSubmission>('SopSubmission', SopSubmissionSchema);

export default SopSubmission;