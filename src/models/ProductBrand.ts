    // src/models/Brand.ts
    import mongoose, { Document, Schema, Model, models } from 'mongoose';

    // FIX: 'export' keyword added and _id is explicitly typed as a string
    export interface IProductBrand extends Document {
    _id: string;
    name: string;
    type: 'Retail' | 'In-House';
    }

    const BrandSchema: Schema<IProductBrand> = new Schema({
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, // Simplified for consistency
    ref: 'Tenant', 
    required: true, 
    // index: true is not needed here as it's part of the compound index below
  },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Retail', 'In-House'], required: true },
}, { timestamps: true });

// THE FIX: The unique index must include tenantId.
BrandSchema.index({ tenantId: 1, name: 1, type: 1 }, { unique: true });

const BrandModel: Model<IProductBrand> = models.ProductBrand || mongoose.model<IProductBrand>('ProductBrand', BrandSchema);

export default BrandModel;