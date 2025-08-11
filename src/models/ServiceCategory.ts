import mongoose, { Document, Schema, Model, models } from 'mongoose';

export interface IServiceCategory extends Document {
  _id: string;
  name: string;
  targetAudience: 'male' | 'female' | 'Unisex';
}

const ServiceCategorySchema: Schema<IServiceCategory> = new Schema({
  tenantId: { 
    type: require('mongoose').Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  name: { type: String, required: true, trim: true },
  targetAudience: { type: String, enum: ['male', 'female', 'Unisex'] },
}, { timestamps: true });

ServiceCategorySchema.index({ name: 1, tenantId: 1 }, { unique: true });

const ServiceCategoryModel: Model<IServiceCategory> = models.ServiceCategory || mongoose.model<IServiceCategory>('ServiceCategory', ServiceCategorySchema);
export default ServiceCategoryModel;