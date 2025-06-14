// salon-app/models/Appointment.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAppointment extends Document {
  customerName: string;
  phoneNumber: string;
  email: string;
  style: string;
  stylist: string;
  date: Date;
  time: string;
  paymentMethod: string;
  products: number[];
  totalPrice: number;
  status: "requested" | "confirmed" | "completed" | "cancelled";
}

const AppointmentSchema: Schema = new mongoose.Schema({
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String, required: true },
  style: { type: String, required: true },
  stylist: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  products: [{ type: Number }],
  totalPrice: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["requested", "confirmed", "completed", "cancelled"],
    default: "requested",
  },
}, { timestamps: true });

// This prevents model recompilation errors in Next.js hot reload
const Appointment: Model<IAppointment> =
  mongoose.models.Appointment ||
  mongoose.model<IAppointment>("Appointment", AppointmentSchema);

export default Appointment;
