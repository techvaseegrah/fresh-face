// models/ServiceItem.ts (Updated)
import mongoose, { Document, Schema, Model, models } from 'mongoose';

export interface IServiceConsumable {
  product: mongoose.Types.ObjectId | any;
  // Updated structure for gender-specific quantities
  quantity: {
    male?: number;    // Optional quantity for male customers
    female?: number;  // Optional quantity for female customers
    default: number;  // Fallback quantity if gender-specific not available
  };
  unit: string;
}

export interface IServiceItem extends Document {
  _id: string;
  name: string;
  price: number;
  membershipRate?: number;
  duration: number;
  subCategory: mongoose.Types.ObjectId | any;
  consumables: IServiceConsumable[];
}

const serviceConsumableSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    male: {
      type: Number,
      min: 0,
      required: false
    },
    female: {
      type: Number,
      min: 0,
      required: false
    },
    default: {
      type: Number,
      required: true,
      min: 0
    }
  },
  unit: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const serviceItemSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  membershipRate: {
    type: Number,
    min: 0,
    sparse: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  subCategory: {
    type: Schema.Types.ObjectId,
    ref: 'ServiceSubCategory',
    required: true
  },
  consumables: [serviceConsumableSchema]
}, { timestamps: true });

// Method to get quantity based on customer gender
serviceItemSchema.methods.getConsumableQuantity = function (productId: string, customerGender: 'male' | 'female' | 'other' = 'other') {
  const consumable = this.consumables.find((c: IServiceConsumable) =>
    c.product.toString() === productId.toString()
  );

  if (!consumable) return 0;

  // Return gender-specific quantity if available, otherwise default
  if (customerGender === 'male' && typeof consumable.quantity.male === 'number') {
    return consumable.quantity.male;
  }
  if (customerGender === 'female' && typeof consumable.quantity.female === 'number') {
    return consumable.quantity.female;
  }

  return consumable.quantity.default;
};

const ServiceItem: Model<IServiceItem> = models.ServiceItem || mongoose.model<IServiceItem>('ServiceItem', serviceItemSchema);
export default ServiceItem;
