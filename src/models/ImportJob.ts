// src/models/ImportJob.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

interface IErrorLog {
  row: number;
  message: string;
  data: string;
}

export interface IImportJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  startedBy: mongoose.Types.ObjectId;
  jobType: 'customerHistory';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: { total: number; processed: number; failed: number; };
  errorLog: IErrorLog[];
  originalFilename: string;
  reportMessage?: string;
}

const ImportJobSchema = new Schema<IImportJob>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  startedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  jobType: { type: String, enum: ['customerHistory'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  progress: {
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  errorLog: [{ row: Number, message: String, data: String }],
  originalFilename: { type: String, required: true },
  reportMessage: { type: String },
}, { timestamps: true });

const ImportJob: Model<IImportJob> = mongoose.models.ImportJob || mongoose.model<IImportJob>('ImportJob', ImportJobSchema);

export default ImportJob;