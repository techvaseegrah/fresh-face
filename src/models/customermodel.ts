// models/customermodel.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { encrypt, decrypt, createSearchHash } from '@/lib/crypto';

export interface ICustomer extends Document {
  name: string;
  phoneNumber: string;
  email?: string; // Now optional
  dob?: Date; // Optional Date of Birth
  survey?: string; // Optional survey info
  phoneHash: string;
  nameHash: string;
  emailHash?: string;
  loyaltyPoints: number;
  isMembership: boolean;
  membershipBarcode?: string;
  membershipPurchaseDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  gender?: 'male' | 'female' | 'other';

  toggleMembership(status?: boolean, customBarcode?: string): Promise<ICustomer>;
}

export interface ICustomerModel extends Model<ICustomer> {
  findByBarcode(barcode: string): Promise<ICustomer | null>;
  checkBarcodeExists(barcode: string): Promise<boolean>;
}

const customerSchema = new Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String, required: false }, // No longer required
  dob: { type: Date, required: false }, // Optional Date of Birth
  survey: { type: String, required: false, trim: true }, // Optional survey info
  phoneHash: { type: String, required: true, unique: true, index: true },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  isMembership: { type: Boolean, default: false, index: true },
  membershipBarcode: { type: String, unique: true, sparse: true, index: true },
  membershipPurchaseDate: { type: Date, sparse: true },
  isActive: { type: Boolean, default: true, index: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: false, lowercase: true },
}, { timestamps: true });

// --- Mongoose Middleware for Encryption ---
customerSchema.pre<ICustomer>('save', function (next) {
  if (this.isModified('name')) this.name = encrypt(this.name);
  if (this.isModified('email') && this.email) this.email = encrypt(this.email);

  if (this.isModified('phoneNumber')) {
    const normalizedPhone = String(this.phoneNumber).replace(/\D/g, '');
    this.phoneHash = createSearchHash(normalizedPhone);
    this.phoneNumber = encrypt(this.phoneNumber);
  }
  next();
});

// --- Mongoose Middleware for Decryption ---
const decryptFields = (doc: any) => {
  if (doc) {
    const decryptedDoc = doc.toObject ? doc.toObject() : { ...doc };

    if (decryptedDoc.name) doc.name = decrypt(decryptedDoc.name);
    if (decryptedDoc.email) doc.email = decrypt(decryptedDoc.email);
    if (decryptedDoc.phoneNumber) doc.phoneNumber = decrypt(decryptedDoc.phoneNumber);
  }
};

customerSchema.post('findOne', decryptFields);
customerSchema.post('find', (docs) => docs.forEach(decryptFields));
customerSchema.post('findOneAndUpdate', decryptFields);
customerSchema.post('save', decryptFields);

// --- Existing Methods ---
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
