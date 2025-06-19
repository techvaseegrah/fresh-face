// src/models/TargetSheet.ts - THE ONLY CORRECT VERSION
import { Schema, model, models, Document } from 'mongoose';

export interface SummaryMetrics {
    service: number;
    retail: number;
    netSales: number;
    bills: number;
    abv: number;
    callbacks: number;
    appointments: number;
}

export interface TargetSheetData {
    _id: string;
    month: string;
    summary: {
        target: Partial<SummaryMetrics>;
        achieved: Partial<SummaryMetrics>;
        headingTo: Partial<SummaryMetrics>;
    };
}

interface ITargetSheet extends Document {
    month: string;
    target: {
        service: number;
        retail: number;
        bills: number;
        abv: number;
        callbacks: number;
        appointments: number; // <-- THE IMPORTANT FIELD
    };
}

const TargetMetricsSchema = new Schema({
    service: { type: Number, default: 0 },
    retail: { type: Number, default: 0 },
    bills: { type: Number, default: 0 },
    abv: { type: Number, default: 0 },
    callbacks: { type: Number, default: 0 },
    // This line tells Mongoose to save the 'appointments' number.
    // Without it, Mongoose will ignore the field.
    appointments: { type: Number, default: 0 }, 
}, { _id: false });

const TargetSheetSchema = new Schema<ITargetSheet>({
    month: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    target: {
        type: TargetMetricsSchema,
        default: () => ({}),
    },
}, {
    timestamps: true,
});

const TargetSheet = models.TargetSheet || model<ITargetSheet>('TargetSheet', TargetSheetSchema);

export default TargetSheet;