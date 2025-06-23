// models/customermodel.ts - UPDATED TO ACCEPT CUSTOM BARCODE
import mongoose, { Document, Model } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  phoneNumber: string;
  email: string;
  loyaltyPoints: number;
  isMembership: boolean;
  membershipBarcode?: string;
  membershipPurchaseDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  gender?: 'male' | 'female' | 'other'; // Add this

  getServicePricing(serviceIds: string[]): Promise<any[]>;
  toggleMembership(status?: boolean, customBarcode?: string): Promise<ICustomer>;
  generateMembershipBarcode(): string;
}

export interface ICustomerModel extends Model<ICustomer> {
  findByBarcode(barcode: string): Promise<ICustomer | null>;
  checkBarcodeExists(barcode: string): Promise<boolean>;
}

const customerSchema = new mongoose.Schema({
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
  
  membershipBarcode: {
    type: String,
    unique: true,
    sparse: true,
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

  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: false,
    lowercase: true
  },

}, { timestamps: true });



// Updated method to toggle membership with custom barcode
customerSchema.methods.toggleMembership = function(this: ICustomer, status = true, customBarcode?: string): Promise<ICustomer> {
  this.isMembership = status;
  if (status) {
    this.membershipPurchaseDate = new Date();
    if (customBarcode) {
      this.membershipBarcode = customBarcode.trim().toUpperCase();
    } 
  } else {
    this.membershipBarcode = undefined;
  }
  return this.save();
};

// Static method to find customer by barcode
customerSchema.statics.findByBarcode = function(this: ICustomerModel, barcode: string): Promise<ICustomer | null> {
  return this.findOne({ 
    membershipBarcode: barcode.trim().toUpperCase(), 
    isMembership: true, 
    isActive: true 
  });
};

// Static method to check if barcode already exists
customerSchema.statics.checkBarcodeExists = function(this: ICustomerModel, barcode: string): Promise<boolean> {
  return this.exists({ 
    membershipBarcode: barcode.trim().toUpperCase(),
    isActive: true 
  }).then(result => !!result);
};

const Customer = (mongoose.models.Customer as ICustomerModel) || 
  mongoose.model<ICustomer, ICustomerModel>('Customer', customerSchema);

export default Customer;