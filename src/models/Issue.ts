import mongoose, { Document, Schema } from 'mongoose';

export interface IIssue extends Document {
  issueName: string;
  assignedTo: mongoose.Schema.Types.ObjectId;
  department: mongoose.Schema.Types.ObjectId;
  status: 'Open' | 'Closed' | 'Resolved' | 'Ignore';
  priority: 'High' | 'Medium' | 'Low' | 'None';
  createdOn: Date;
  createdBy: mongoose.Schema.Types.ObjectId;
  outlet: string;
}

const IssueSchema: Schema = new Schema({
  issueName: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  status: { type: String, default: 'Open' },
  priority: { type: String, default: 'None' },
  createdOn: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  outlet: { type: String, required: true },
});

export default mongoose.models.Issue || mongoose.model<IIssue>('Issue', IssueSchema);