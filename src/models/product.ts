import mongoose, { Schema, model, models } from 'mongoose';

const ProductSchema = new Schema({
  name: { 
    type: String, 
    required: [true, 'Product name is required.'],
    trim: true,
  },
  
  sku: { // Stock Keeping Unit (e.g., barcode number). Good for future scanner integration.
    type: String, 
    unique: true,
    sparse: true, // Allows multiple products to have no SKU, but any SKU that exists must be unique.
    trim: true,
  },

  brand: { 
    type: String,
    trim: true,
  },

  category: { 
    type: String,
    trim: true,
    index: true, // Index for faster filtering by category (e.g., "Shampoo", "Styling").
  },

  // This is the most important field to differentiate how products are handled.
  type: { 
    type: String, 
    enum: ['Retail', 'Professional'], 
    required: [true, 'Product type (Retail or Professional) is required.'],
    index: true,
  },

  purchasePrice: { // The price you pay your supplier for one unit.
    type: Number, 
    required: [true, 'Purchase price is required.'],
    min: [0, 'Purchase price cannot be negative.']
  },

  retailPrice: { // The price you sell one unit to the customer.
    type: Number,
    // This price is only required if the product is a 'Retail' item.
    required: function(this: { type: string }) { return this.type === 'Retail'; },
    min: [0, 'Retail price cannot be negative.']
  },

  currentStock: { // The current quantity you have on hand.
    type: Number, 
    required: true,
    default: 0,
    min: [0, 'Stock cannot be negative.']
  },

  reorderLevel: { // The low-stock warning threshold. When stock hits this level, you know to reorder.
    type: Number, 
    required: true,
    default: 0,
    min: [0, 'Reorder level cannot be negative.']
  },
  
  supplier: { // The name of the supplier you buy this from.
    type: String,
    trim: true,
  },

  // A flag to "archive" products you no longer sell, instead of deleting them.
  isActive: { 
    type: Boolean,
    default: true,
    index: true,
  }
}, { 
  timestamps: true // Automatically adds createdAt and updatedAt fields.
});

// Create a text index on name and brand to allow for fast, fuzzy text searching.
ProductSchema.index({ name: 'text', brand: 'text', category: 'text' });

const Product = models.Product || model('Product', ProductSchema);

export default Product;