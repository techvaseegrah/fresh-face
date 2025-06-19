// models/customermodel.ts - SIMPLIFIED VERSION WITH BOOLEAN MEMBERSHIP
import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, index: true },
  
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // === SIMPLE MEMBERSHIP FIELD ===
  isMembership: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Optional: Track when membership was purchased
  membershipPurchaseDate: {
    type: Date,
    sparse: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

}, { timestamps: true });

// Method to get pricing for services based on membership status
customerSchema.methods.getServicePricing = async function(serviceIds) {
  const ServiceItem = mongoose.model('ServiceItem');
  const services = await ServiceItem.find({ _id: { $in: serviceIds } });
  
  return services.map(service => ({
    serviceId: service._id,
    serviceName: service.name,
    originalPrice: service.price,
    finalPrice: this.isMembership && service.membershipRate ? 
      service.membershipRate : service.price,
    membershipDiscount: this.isMembership && service.membershipRate ? 
      (service.price - service.membershipRate) : 0,
    isMembershipApplied: this.isMembership && !!service.membershipRate
  }));
};

// Method to toggle membership status
customerSchema.methods.toggleMembership = function(status = true) {
  this.isMembership = status;
  if (status) {
    this.membershipPurchaseDate = new Date();
  }
  return this.save();
};

export default mongoose.models.Customer || mongoose.model('Customer', customerSchema);
