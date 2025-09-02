import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// --- Interfaces ---
export interface IChecklistQuestion {
  questionText: string;
  responseType: 'Yes/No' | 'Yes/No + Remarks';
  mediaUpload: 'None' | 'Optional' | 'Required';
}
export interface IChecklistAnswer {
  questionText: string;
  answer: 'Yes' | 'No' | null;
  remarks?: string;
  mediaUrl?: string;
}

export interface ITask extends Document {
  tenantId: Types.ObjectId;
  taskName: string;
  assignedTo?: Types.ObjectId;
  position: string;
  status: 'Ongoing' | 'Overdue' | 'Completed' | 'Pending' | 'Awaiting Review' | 'Approved' | 'Rejected';
  priority: 'High' | 'Medium' | 'Low' | 'None';
  dueDate: Date;
  createdBy: Types.ObjectId;
  isRecurring: boolean;
  frequency: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  isGroupMaster: boolean;
  parentTaskId?: Types.ObjectId;
  checklistQuestions?: IChecklistQuestion[];
  checklistAnswers?: IChecklistAnswer[];
  // --- LINE ADDED HERE ---
  reviewedAt?: Date; // To store the timestamp of the approval/rejection
}

// --- Schemas ---
const ChecklistQuestionSchema = new Schema({
  questionText: { type: String, required: true },
  responseType: { type: String, enum: ['Yes/No', 'Yes/No + Remarks'], default: 'Yes/No' },
  mediaUpload: { type: String, enum: ['None', 'Optional', 'Required'], default: 'None' },
}, { _id: false });

const ChecklistAnswerSchema = new Schema({
  questionText: { type: String, required: true },
  answer: { type: String, enum: ['Yes', 'No', null], default: null },
  remarks: { type: String },
  mediaUrl: { type: String },
}, { _id: false });

const TaskSchema: Schema<ITask> = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  taskName: { type: String, required: true, trim: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Staff' },
  position: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Ongoing', 'Overdue', 'Completed', 'Pending', 'Awaiting Review', 'Approved', 'Rejected'], default: 'Pending' },
  priority: { type: String, enum: ['High', 'Medium', 'Low', 'None'], default: 'None' },
  dueDate: { type: Date, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  isRecurring: { type: Boolean, default: false },
  frequency: { type: String, enum: ['None', 'Daily', 'Weekly', 'Monthly'], default: 'None' },
  isGroupMaster: { type: Boolean, default: false },
  parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  checklistQuestions: [ChecklistQuestionSchema],
  checklistAnswers: [ChecklistAnswerSchema],
  // --- FIELD ADDED HERE ---
  reviewedAt: {
    type: Date, // Defines the field in the database
  },
}, { timestamps: true });

TaskSchema.index({ tenantId: 1, status: 1 });

const Task: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);
export default Task;