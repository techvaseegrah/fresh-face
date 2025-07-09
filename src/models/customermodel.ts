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
  email: { type: String, required: false },

  // --- Search & Index Fields ---
  phoneHash: { type: String, required: true, unique: true, index: true },
  searchableName: { type: String, required: true, index: true, lowercase: true },
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

// --- REMOVED ---
// The pre('save') hook was the source of validation errors due to dev server caching.
// This logic is now handled explicitly in the API route.

// --- Mongoose Middleware for Decryption (CORRECT) ---
const decryptFields = (doc: any) => {
  if (doc) {
    const decryptedDoc = doc.toObject ? doc.toObject() : { ...doc };
    if (decryptedDoc.name) doc.name = decrypt(decryptedDoc.name);
    if (decryptedDoc.email) doc.email = decrypt(decryptedDoc.email);
    if (decryptedDoc.phoneNumber) doc.phoneNumber = decrypt(decryptedDoc.phoneNumber);
  }
};

// These hooks correctly handle all "read" operations.
customerSchema.post('findOne', decryptFields);
customerSchema.post('find', (docs) => docs.forEach(decryptFields));
customerSchema.post('findOneAndUpdate', decryptFields);

// --- REMOVED ---
// The post('save') hook was causing the "_id of null" error.

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