import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for TypeScript type safety
export interface IStylist extends Document {
  name: string;
  experience: number; // in years
  specialization: string;
  phone: string;
}

// Mongoose Schema definition
const StylistSchema: Schema<IStylist> = new Schema({
  name: {
    type: String,
    required: [true, 'Stylist name is required.'],
    trim: true,
  },
  experience: {
    type: Number,
    required: [true, 'Experience in years is required.'],
    min: 0,
  },
  specialization: {
    type: String,
    required: [true, 'Specialization is required.'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required.'],
    trim: true,
  },
}, { timestamps: true }); // Adds createdAt and updatedAt timestamps

const StylistModel: Model<IStylist> = mongoose.models.Stylist || mongoose.model<IStylist>('Stylist', StylistSchema);

export default StylistModel;