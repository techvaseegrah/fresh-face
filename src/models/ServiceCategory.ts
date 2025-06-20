import mongoose, { Document, Schema, Model, models } from 'mongoose';

export interface IServiceCategory extends Document {
  _id: string;
  name: string;
  targetAudience: 'Men' | 'Women' | 'Unisex' | 'Children';
}

const ServiceCategorySchema: Schema<IServiceCategory> = new Schema({
  name: { type: String, required: true, trim: true },
  targetAudience: { type: String, enum: ['Men', 'Women', 'Unisex', 'Children'], required: true },
}, { timestamps: true });

ServiceCategorySchema.index({ name: 1, targetAudience: 1 }, { unique: true });

const ServiceCategoryModel: Model<IServiceCategory> = models.ServiceCategory || mongoose.model<IServiceCategory>('ServiceCategory', ServiceCategorySchema);
export default ServiceCategoryModel;