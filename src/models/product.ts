import mongoose, { Document, Schema, Model, models } from 'mongoose';
// Import the interfaces from your newly named models for type safety
import { IProductBrand } from './ProductBrand';
import { IProductSubCategory } from './ProductSubCategory';

/**
 * A generic interface for a populated reference, used for type safety in the IProduct interface.
 */
export interface IRefPopulated {
  _id: string;
  name: string;
}

/**
 * The primary interface for a Product document, representing a single product in the database.
 * The 'brand' and 'subCategory' fields can be either an ObjectId or a populated object.
 */
export interface IProduct extends Document {
  _id: string;
  sku: string;
  name: string;
  price: number; 
  brand: mongoose.Types.ObjectId | IProductBrand;
  subCategory: mongoose.Types.ObjectId | IProductSubCategory;
  type: 'Retail' | 'In-House';
  expiryDate?: Date | null;
  quantity: number;
  stockedDate: Date;
  unit: string;
}

/**
 * The Mongoose Schema that defines the structure and rules for the 'products' collection.
 */
const ProductSchema: Schema<IProduct> = new Schema({
  sku: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    uppercase: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  price: {
    type: Number, 
    required: [true, "Price is required."], 
    min: 0
  },
  // --- THIS IS THE CRUCIAL FIX ---
  // The 'ref' now points to the new, specific model names.
  brand: { 
    type: Schema.Types.ObjectId, 
    ref: 'ProductBrand', // Changed from 'Brand'
    required: true 
  },
  subCategory: { 
    type: Schema.Types.ObjectId, 
    ref: 'ProductSubCategory', // Changed from 'SubCategory'
    required: true 
  },
  // --- END OF FIX ---
  type: { 
    type: String, 
    enum: ['Retail', 'In-House'], 
    required: true 
  },
  expiryDate: { 
    type: Date, 
    required: false 
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  stockedDate: { 
    type: Date, 
    required: true 
  },
  unit: { 
    type: String, 
    required: true, 
    trim: true 
  },
}, { timestamps: true });

/**
 * The Mongoose Model for interacting with the 'products' collection.
 * The `models.Product || ...` pattern prevents recompiling the model in Next.js development.
 */
const ProductModel: Model<IProduct> = models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default ProductModel;