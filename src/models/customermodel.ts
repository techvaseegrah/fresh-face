// models/customermodel.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { encrypt, decrypt } from '@/lib/crypto'; // Assuming crypto has these exports

// Interface for the document instance
export interface ICustomer extends Document {
  tenantId: mongoose.Types.ObjectId;

  // --- Encrypted Fields ---
  name: string;
  phoneNumber: string;
  email?: string;
     
  // --- Search & Index Fields ---
  phoneHash: string; // Blind index of the full phone number
  searchableName: string; // Lowercase, unencrypted version of the name for searching
  last4PhoneNumber?: string;
  phoneSearchIndex: string[]; // N-gram blind indexes for partial phone number search

  // --- Other Data Fields ---
  dob?: Date;
  gender?: 'male' | 'female' | 'other';
  survey?: string;
  loyaltyPoints: number;
  
  // --- Membership Fields ---
  isMembership: boolean;
  membershipBarcode?: string; // This will be unique PER TENANT
  membershipPurchaseDate?: Date;

  // --- Status and Timestamps ---
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // --- Methods ---
  toggleMembership(status?: boolean, customBarcode?: string): Promise<ICustomer>;
}

// Interface for the model itself (for static methods)
export interface ICustomerModel extends Model<ICustomer> {
  findByBarcode(barcode: string, tenantId: string): Promise<ICustomer | null>;
  checkBarcodeExists(barcode: string, tenantId: string): Promise<boolean>;
}

const customerSchema = new Schema<ICustomer, ICustomerModel>({
  tenantId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true,
  },
  
  // --- Sensitive Fields (to be encrypted in application logic before saving) ---
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String }, // Not required

  // --- Search & Index Fields (do not encrypt these) ---
  phoneHash: { type: String, required: true },
  searchableName: { type: String, required: true, lowercase: true },
  last4PhoneNumber: { type: String },
  phoneSearchIndex: { type: [String] },

  // --- Other Data Fields ---
  dob: { type: Date },
  survey: { type: String, trim: true },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  gender: { type: String, enum: ['male', 'female', 'other'], lowercase: true },

  // --- Membership Fields ---
  isMembership: { type: Boolean, default: false },
  // CORRECT: Inline indexing options removed. The multi-tenant index is defined below.
  membershipBarcode: { type: String }, 
  membershipPurchaseDate: { type: Date },

  // --- Status ---
  isActive: { type: Boolean, default: true },
}, 
{ 
  timestamps: true // Automatically adds createdAt and updatedAt
});

// =========================================================================
// === EXPLICIT INDEX DEFINITIONS (Best Practice for Multi-Tenancy) ======
// =========================================================================

// Ensures a phone number is unique FOR EACH TENANT.
customerSchema.index({ tenantId: 1, phoneHash: 1 }, { unique: true });

// Ensures an email is unique FOR EACH TENANT, but allows multiple customers
// without an email (sparse: true).
customerSchema.index({ tenantId: 1, email: 1 }, { unique: true, sparse: true });

// Ensures a membership barcode is unique FOR EACH TENANT, but allows multiple
// customers without a barcode. THIS FIXES YOUR ORIGINAL ERROR.
customerSchema.index({ tenantId: 1, membershipBarcode: 1 }, { unique: true, sparse: true });

// --- Performance Indexes for Common Queries ---
customerSchema.index({ searchableName: 1 });
customerSchema.index({ phoneSearchIndex: 1 });
customerSchema.index({ isActive: 1, isMembership: 1 });


// =========================================================================
// =================== STATIC & INSTANCE METHODS =========================
// =========================================================================

// NOTE: Decryption logic is best handled in the API layer (`/api/...`) right before
// sending the data to the client, not in a global Mongoose hook. This gives you
// more control and prevents decrypted data from being accidentally logged or used internally.

customerSchema.methods.toggleMembership = function (this: ICustomer, status = true, customBarcode?: string): Promise<ICustomer> {
  this.isMembership = status;
  if (status) {
    this.membershipPurchaseDate = new Date();
    if (customBarcode) {
      // It's good practice to normalize barcodes (e.g., uppercase, trimmed)
      this.membershipBarcode = customBarcode.trim().toUpperCase();
    }
  } else {
    // Set to undefined to remove it completely, works well with sparse indexes
    this.membershipBarcode = undefined; 
  }
  return this.save();
};

customerSchema.statics.findByBarcode = function (this: ICustomerModel, barcode: string, tenantId: string): Promise<ICustomer | null> {
  return this.findOne({
    tenantId: tenantId,
    membershipBarcode: barcode.trim().toUpperCase(),
    isMembership: true,
    isActive: true
  });
};

customerSchema.statics.checkBarcodeExists = function (this: ICustomerModel, barcode: string, tenantId: string): Promise<boolean> {
  return this.exists({
    tenantId: tenantId,
    membershipBarcode: barcode.trim().toUpperCase(),
  }).then(result => !!result);
};


// =========================================================================
// ============================ MODEL EXPORT ===============================
// =========================================================================

// This pattern prevents "OverwriteModelError" in Next.js hot-reload environments
const Customer = (mongoose.models.Customer as ICustomerModel) || mongoose.model<ICustomer, ICustomerModel>('Customer', customerSchema);

export default Customer;