// models/Product.ts
import mongoose, { Document, Schema, Model, models } from 'mongoose';
import { IProductBrand } from './ProductBrand';
import { IProductSubCategory } from './ProductSubCategory';

export interface IRefPopulated {
  _id: string;
  name: string;
}

export interface IProduct extends Document {
  _id: string;
  sku: string;
  name: string;
  price: number;
  brand: mongoose.Types.ObjectId | IProductBrand;
  subCategory: mongoose.Types.ObjectId | IProductSubCategory;
  type: 'Retail' | 'In-House';
  expiryDate?: Date | null;
  totalQuantity: number; // Total quantity in base units (ml, g, etc.)
  numberOfItems: number; // Number of bottles/pieces
  quantityPerItem: number; // Capacity per bottle/piece
  unit: string;
  stockedDate: Date;
}

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
  brand: {
    type: Schema.Types.ObjectId,
    ref: 'ProductBrand',
    required: true
  },
  subCategory: {
    type: Schema.Types.ObjectId,
    ref: 'ProductSubCategory',
    required: true
  },
  type: {
    type: String,
    enum: ['Retail', 'In-House'],
    required: true
  },
  expiryDate: {
    type: Date,
    required: false
  },
  totalQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  numberOfItems: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  quantityPerItem: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['ml', 'g', 'kg', 'l'],
    trim: true
  },
  stockedDate: {
    type: Date,
    required: true
  }
}, { timestamps: true });

// Calculate total quantity before saving
ProductSchema.pre('save', function(next) {
  this.totalQuantity = this.numberOfItems * this.quantityPerItem;
  next();
});

const ProductModel: Model<IProduct> = models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default ProductModel;
