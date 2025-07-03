// models/customermodel.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { encrypt, decrypt, createSearchHash } from '@/lib/crypto';

export interface ICustomer extends Document {
  name: string;
  phoneNumber: string;
  email: string;
  phoneHash: string;
  nameHash: string;      // NEW
  emailHash: string;     // NEW
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
  phoneNumber: { type: String, required: true }, // Will store encrypted number
  email: { type: String, required: true }, // Will store encrypted email
  // nameHash: { type: String, required: true, index: true },
  // emailHash: { type: String, required: true, unique: true, index: true },
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
  // Encrypt fields only if they are modified
  if (this.isModified('name')) this.name = encrypt(this.name);
  if (this.isModified('email')) this.email = encrypt(this.email);

  if (this.isModified('phoneNumber')) {
    // Note: The raw phoneNumber is available here before encryption
    const normalizedPhone = String(this.phoneNumber).replace(/\D/g, '');
    this.phoneHash = createSearchHash(normalizedPhone);
    this.phoneNumber = encrypt(this.phoneNumber);
  }
  next();
});

// --- Mongoose Middleware for Decryption ---
const decryptFields = (doc: any) => {
  if (doc) {
    // Use a temporary variable for batch updates to avoid re-encrypting decrypted data
    const decryptedDoc = doc.toObject ? doc.toObject() : { ...doc };

    if (decryptedDoc.name) doc.name = decrypt(decryptedDoc.name);
    if (decryptedDoc.email) doc.email = decrypt(decryptedDoc.email);
    if (decryptedDoc.phoneNumber) doc.phoneNumber = decrypt(decryptedDoc.phoneNumber);
  }
};

customerSchema.post('findOne', decryptFields);
customerSchema.post('find', (docs) => docs.forEach(decryptFields));
customerSchema.post('findOneAndUpdate', decryptFields);
customerSchema.post('save', decryptFields); // Decrypt after saving to have plain text in the returned object

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