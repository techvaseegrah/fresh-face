// models/customermodel.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { encrypt, decrypt, createSearchHash } from '@/lib/crypto';

export interface ICustomer extends Document {
  // --- Encrypted Fields ---
  name: string;
  phoneNumber: string;
  email?: string;
     
  // --- Search & Index Fields ---
  phoneHash: string;
  searchableName: string;
  last4PhoneNumber?: string;

  // --- Other Existing Fields ---
  dob?: Date;
  survey?: string;
  loyaltyPoints: number;
  isMembership: boolean;
  membershipBarcode?: string;
  membershipPurchaseDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  gender?: 'male' | 'female' | 'other';

  // --- Methods ---
  toggleMembership(status?: boolean, customBarcode?: string): Promise<ICustomer>;
}

export interface ICustomerModel extends Model<ICustomer> {
  findByBarcode(barcode: string): Promise<ICustomer | null>;
  checkBarcodeExists(barcode: string): Promise<boolean>;
}

const customerSchema = new Schema({
  // --- Sensitive Fields ---
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  
  // --- THIS IS THE FIX ---
  // The 'sparse' option tells the unique index to ignore documents where 'email' is null.
  // This allows multiple customers to be created without an email address.
  email: { 
    type: String, 
    required: false,
    unique: true,
    sparse: true
  },

  // --- Search & Index Fields ---
  phoneHash: { type: String, required: true, unique: true, index: true },
  searchableName: { type: String, required: true,index: true, lowercase: true },
  last4PhoneNumber: { type: String, index: true },

  // --- Other Existing Fields ---
  dob: { type: Date, required: false },
  survey: { type: String, required: false, trim: true },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  isMembership: { type: Boolean, default: false, index: true },
  membershipBarcode: { type: String, unique: true, sparse: true, index: true },
  membershipPurchaseDate: { type: Date, sparse: true },
  isActive: { type: Boolean, default: true, index: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: false, lowercase: true },
}, { timestamps: true });

// --- Mongoose Middleware for Decryption (CORRECT) ---
const decryptFields = (doc: any) => {
  if (doc) {
    if (doc.name) doc.name = decrypt(doc.name);
    if (doc.email) doc.email = decrypt(doc.email);
    if (doc.phoneNumber) doc.phoneNumber = decrypt(doc.phoneNumber);
  }
};

customerSchema.post('findOne', decryptFields);
customerSchema.post('find', (docs) => docs.forEach(decryptFields));
customerSchema.post('findOneAndUpdate', decryptFields);

// customerSchema.post('save', (doc, next) => {
//   decryptFields(doc);
//   next();
// });

// --- Existing Methods & Statics (Unchanged) ---
customerSchema.methods.toggleMembership = function (this: ICustomer, status = true, customBarcode?: string): Promise<ICustomer> {
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

customerSchema.statics.findByBarcode = function (this: ICustomerModel, barcode: string): Promise<ICustomer | null> {
  return this.findOne({
    membershipBarcode: barcode.trim().toUpperCase(),
    isMembership: true,
    isActive: true
  });
};

customerSchema.statics.checkBarcodeExists = function (this: ICustomerModel, barcode: string): Promise<boolean> {
  return this.exists({
    membershipBarcode: barcode.trim().toUpperCase(),
    isActive: true
  }).then(result => !!result);
};

const Customer = (mongoose.models.Customer as ICustomerModel) ||
  mongoose.model<ICustomer, ICustomerModel>('Customer', customerSchema);

export default Customer;