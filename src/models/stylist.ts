// models/stylist.ts
import mongoose, { Schema, model, models } from 'mongoose';

const StylistSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    trim: true 
  },
  // You can add more stylist details here (email, phone, etc.)

  // This field tracks the stylist's real-time status
  availabilityStatus: {
    type: String,
    enum: ['Available', 'Busy', 'On-Break'], // Simplified for now
    default: 'Available',
    required: true
  },
  
  // This links a 'Busy' stylist to the specific appointment they are working on
  currentAppointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null // Null when the stylist is 'Available'
  }
});

const Stylist = models.Stylist || model('Stylist', StylistSchema);
export default Stylist;