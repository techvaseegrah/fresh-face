import mongoose, { Schema, Document, models, Model } from 'mongoose';

// 1. TypeScript-க்கான Interface (Type Safety-க்காக)
export interface IIncome extends Document {
  tenantId: mongoose.Schema.Types.ObjectId;
  amount: number;
  description: string;
  category?: string; // Optional field
  createdAt: Date;
  updatedAt: Date;
}

// 2. Mongoose Schema-வை உருவாக்குதல்
const IncomeSchema: Schema<IIncome> = new Schema(
  {
    // ஒவ்வொரு tenant-ஐயும் பிரித்துக் காட்ட இந்த ID அவசியம்
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant', // 'Tenant' மாடலுடன் தொடர்புபடுத்துகிறது
      required: true,
    },
    // வருமானத்தின் தொகை. நமது API இதைத்தான் கணக்கிடுகிறது
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    // வருமானம் எதற்கானது என்ற விளக்கம்
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    // வருமானத்தின் வகை (e.g., "Sales", "Service", "Other")
    category: {
      type: String,
      trim: true,
    },
  },
  {
    // createdAt மற்றும் updatedAt புலங்களை தானாகவே உருவாக்கும்
    timestamps: true,
  }
);

// Database-ல் தேடலை வேகப்படுத்த Indexing
IncomeSchema.index({ tenantId: 1, createdAt: -1 });


// 3. மாடலை உருவாக்குதல் (Next.js Hot Reloading-க்கு ஏற்றவாறு)
// இந்த ஃபைல் ரன் ஆகும் ஒவ்வொரு முறையும் புதிய மாடல் உருவாவதைத் தடுக்கிறது
const Income: Model<IIncome> = models.Income || mongoose.model<IIncome>('Income', IncomeSchema);

export default Income;