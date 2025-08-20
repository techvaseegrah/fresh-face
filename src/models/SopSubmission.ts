import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISopSubmission extends Document {
  sop: mongoose.Schema.Types.ObjectId;
  staff: mongoose.Schema.Types.ObjectId;
  tenantId: mongoose.Schema.Types.ObjectId;
  submissionDate: Date;
  responses: { text: string; checked: boolean; }[];
  createdAt: Date;
  isReviewed: boolean; // <-- ADD THIS
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
    imageUrl: { type: String, required: false }
  }],
   isReviewed: { type: Boolean, default: false }, // <-- ADD THIS
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

SopSubmissionSchema.index({ sop: 1, staff: 1, submissionDate: 1 }, { unique: true });

const SopSubmission: Model<ISopSubmission> = mongoose.models.SopSubmission || mongoose.model<ISopSubmission>('SopSubmission', SopSubmissionSchema);

export default SopSubmission;