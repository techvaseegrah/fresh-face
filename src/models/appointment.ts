// models/appointment.ts - ADD AMOUNT CALCULATION
import mongoose, { Schema, model, models } from 'mongoose';
import './Stylist'; 
import './ServiceItem';
import './customermodel';

const appointmentSchema = new Schema({
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  
  serviceIds: [{ 
    type: Schema.Types.ObjectId,
    ref: 'ServiceItem',
    required: [true, 'At least one service is required.']
  }],
  
  stylistId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Stylist',
    required: true,
    index: true
  },
  
  appointmentType: {
    type: String,
    enum: ['Online', 'Offline'],
    required: true,
    default: 'Online'
  },
  
  status: {
    type: String,
    enum: [
      'Appointment',
      'Checked-In',
      'Checked-Out',
      'Paid',
      'Cancelled',
      'No-Show'
    ],
    default: 'Appointment'
  },
  
  // Timestamps
  appointmentTime: { type: Date, required: true },
  checkInTime: { type: Date, sparse: true },
  checkOutTime: { type: Date, sparse: true },
  
  date: { type: Date, required: true },
  time: { type: String, required: true },
  notes: { type: String },
  
  // === BILLING INFORMATION ===
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  membershipDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  finalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  invoiceId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Invoice',
    sparse: true
  },
  
  // Duration tracking
  estimatedDuration: { type: Number, required: true },
  actualDuration: { type: Number, sparse: true }
  
}, { timestamps: true });

// Method to calculate appointment total
appointmentSchema.methods.calculateTotal = async function(includeAdditionalItems = []) {
  await this.populate('serviceIds customerId');
  
  let serviceTotal = 0;
  let membershipSavings = 0;
  
  // Calculate service costs
  for (const service of this.serviceIds) {
    const isCustomerMember = this.customerId?.isMembership || false;
    const hasDiscount = isCustomerMember && service.membershipRate;
    
    const price = hasDiscount ? service.membershipRate : service.price;
    serviceTotal += price;
    
    if (hasDiscount) {
      membershipSavings += (service.price - service.membershipRate);
    }
  }
  
  // Add any additional items (products, etc.)
  const additionalTotal = includeAdditionalItems.reduce((sum, item) => sum + item.finalPrice, 0);
  
  const total = serviceTotal + additionalTotal;
  
  return {
    serviceTotal,
    additionalTotal,
    membershipSavings,
    grandTotal: total,
    originalTotal: serviceTotal + membershipSavings + additionalTotal
  };
};

appointmentSchema.index({ stylistId: 1, date: 1 });
appointmentSchema.index({ customerId: 1, date: -1 });
appointmentSchema.index({ status: 1, appointmentType: 1 });

const Appointment = models.Appointment || model('Appointment', appointmentSchema);
export default Appointment;