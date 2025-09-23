// This file centralizes all type definitions for the booking form components.
'use client';

// Importing a shared type from your existing CRM module
import { CustomerPackage as CrmCustomerPackage } from '@/app/(main)/crm/types';

// Re-exporting for local use
export type CustomerPackage = CrmCustomerPackage;

export interface SearchableItem {
  _id: string;
  name: string;
  price: number;
  duration?: number;
  membershipRate?: number;
  type: 'service' | 'product';
}

export interface ProductFromAPI {
  _id: string;
  name: string;
  price: number;
  membershipRate?: number;
}

export interface BaseAppointmentItem {
  _tempId: string;
  itemId: string;
  itemName: string;
  price: number;
  membershipRate?: number;
  isRedeemed?: boolean;
}

export interface ServiceAppointmentItem extends BaseAppointmentItem {
  type: 'service';
  serviceId: string;
  stylistId: string;
  guestName?: string;
  duration: number;
  availableStylists: StylistFromAPI[];
  isLoadingStylists: boolean;
}

export interface ProductAppointmentItem extends BaseAppointmentItem {
  type: 'product';
}

export type AppointmentItemState = ServiceAppointmentItem | ProductAppointmentItem;

export interface NewBookingData {
  customerId?: string;
  phoneNumber: string;
  customerName: string;
  email: string;
  gender?: string;
  dob?: string;
  survey?: string;
  serviceAssignments: { serviceId: string; stylistId: string; guestName?: string }[];
  productAssignments: { productId: string }[];
  date: string;
  time: string;
  notes?: string;
  status: 'Appointment' | 'Checked-In';
  appointmentType?: 'Online' | 'Offline';
  redeemedItems?: {
    customerPackageId: string;
    redeemedItemId: string;
    redeemedItemType: 'service' | 'product';
  }[];
}

export interface AppointmentFormData {
  customerId?: string;
  phoneNumber: string;
  customerName: string;
  email: string;
  gender: string;
  dob: string;
  survey: string;
  date: string;
  time: string;
  notes: string;
  status: 'Appointment' | 'Checked-In';
}

export interface ServiceFromAPI { _id: string; name: string; price: number; duration: number; membershipRate?: number; }
export interface StylistFromAPI { _id: string; name: string; }
export interface CustomerSearchResult { _id: string; name: string; phoneNumber: string; email?: string; gender?: string; dob?: string; survey?: string; }

export interface AppointmentHistory {
  _id: string;
  date: string;
  services: string[];
  totalAmount: number;
  stylistName: string;
  status: string;
  isImported?: boolean;
  invoiceNumber?: string;
  paymentMode?: string;
}

export interface CustomerDetails { _id: string; name: string; email: string; phoneNumber: string; dob: string | null; survey: string | null; isMember: boolean; membershipDetails: { planName: string; status: string } | null; lastVisit: string | null; appointmentHistory: AppointmentHistory[]; loyaltyPoints?: number; membershipBarcode?: string; }
export interface BookAppointmentFormProps { isOpen: boolean; onClose: () => void; onBookAppointment: (data: NewBookingData) => Promise<void>; }