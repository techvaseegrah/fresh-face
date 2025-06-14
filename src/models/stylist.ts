// models/stylist.ts
import mongoose, { Schema, model, models, Document, Types } from 'mongoose';

export interface IStylist extends Document {
  staffInfo: Types.ObjectId; // Reference to the main Staff document
  availabilityStatus: 'Available' | 'Busy' | 'On-Break';
  currentAppointmentId: Types.ObjectId | null;
}

const StylistSchema = new Schema<IStylist>({
  staffInfo: { 
    type: Schema.Types.ObjectId, 
    ref: 'Staff', // This tells Mongoose it's a link to the 'Staff' collection
    required: true,
    unique: true // A staff member can only be one stylist
  },
  availabilityStatus: {
    type: String,
    enum: ['Available', 'Busy', 'On-Break'],
    default: 'Available',
    required: true
  },
  currentAppointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  }
});

const Stylist = models.Stylist || model<IStylist>('Stylist', StylistSchema);
export default Stylist;