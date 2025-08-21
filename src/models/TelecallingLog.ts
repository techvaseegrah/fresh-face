// src/models/TelecallingLog.ts
import mongoose, { Document, Schema, model, Types } from 'mongoose';

export interface ITelecallingLog extends Document {
  tenantId: Types.ObjectId;
  customerId: Types.ObjectId;
  callerId: Types.ObjectId; // The user (telecaller) who made the call
  outcome: string; // e.g., 'Appointment Booked', 'Not Interested', 'Number Busy'
  notes?: string; // For complaints or specific details
  appointmentId?: Types.ObjectId; // Link to the appointment if one was booked
  callbackDate?: Date; // We will use this in Phase 2
  createdAt: Date;
}

const TelecallingLogSchema = new Schema<ITelecallingLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  outcome: { 
    type: String, 
    required: true,
    enum: [
      'Appointment Booked',
      'Will Come Later',
      'Not Interested',
      'No Reminder Call',
      'Switched Off',
      'Number Busy',
      'Specific Date',
      'Complaint'
    ]
  },
  notes: { type: String },
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  callbackDate: { type: Date },
}, { timestamps: true });

export default mongoose.models.TelecallingLog || model<ITelecallingLog>('TelecallingLog', TelecallingLogSchema);