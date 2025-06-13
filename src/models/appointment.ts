// models/appointment.ts
import mongoose, { Schema, model, models } from 'mongoose';

// Ensure Mongoose knows about the other models it needs to reference.
import './stylist'; 
import './service';
import './customermodel';

const appointmentSchema = new Schema({
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  
  // This is the field that was missing or incorrect.
  // It MUST be named 'serviceIds' and be an array of references.
  serviceIds: [{ 
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'At least one service is required.']
  }],
  
  stylistId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Stylist',
    required: true,
    index: true
  },
  
  date: { 
    type: Date, 
    required: true 
  },
  time: { 
    type: String, 
    required: true 
  },
  notes: { 
    type: String 
  },
  status: {
    type: String,
    enum: [
      'Scheduled',
      'Checked-In',
      'Billed',
      'Paid',
      'Cancelled',
      'No-Show'
    ],
    default: 'Scheduled'
  },
  amount: {
    type: Number 
  },
  invoiceId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Invoice', // This name must exactly match your Invoice model name
    index: true, // Good for performance
  },
  
}, { timestamps: true });

// Indexes to speed up common database queries
appointmentSchema.index({ stylistId: 1, date: 1 });
appointmentSchema.index({ customerId: 1, date: -1 });

const Appointment = models.Appointment || model('Appointment', appointmentSchema);
export default Appointment;
