import mongoose from 'mongoose';

// Define an interface for the Customer document for better type safety
// Although not required to fix this specific error, it's a best practice.
export interface ICustomer extends mongoose.Document {
  name: string;
  phoneNumber: string;
  email: string;
  loyaltyPoints: number;
  isMembership: boolean;
  membershipPurchaseDate?: Date;
  isActive: boolean;
  // Method signatures
  getServicePricing(serviceIds: mongoose.Types.ObjectId[]): Promise<any[]>;
  toggleMembership(status?: boolean): Promise<this>;
}

const customerSchema = new mongoose.Schema<ICustomer>({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, index: true },
  
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  
  isMembership: {
    type: Boolean,
    default: false,
    index: true
  },
  
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
//                                                       V-- FIX: Add the type annotation here --V
customerSchema.methods.getServicePricing = async function(serviceIds: mongoose.Types.ObjectId[]) {
  // It's safer to get the model from the connection in case it's not registered yet
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

export default mongoose.models.Customer || mongoose.model<ICustomer>('Customer', customerSchema);