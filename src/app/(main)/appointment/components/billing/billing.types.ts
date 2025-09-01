// appointment/components/billing/billing.types.ts

export interface BillLineItem {
  itemType: 'service' | 'product' | 'fee';
  itemId: string;
  name: string;
  unitPrice: number;
  membershipRate?: number;
  quantity: number;
  finalPrice: number;
  staffId?: string;
  isRemovable?: boolean;
}

export interface SearchableItem {
  id: string;
  name: string;
  price: number;
  membershipRate?: number;
type: 'service' | 'product' | 'fee' | 'gift_card';
  categoryName?: string;
  unit?: string;
}

export interface AppointmentForModal {
  _id: string;
  id: string;
  invoiceId?: string | { _id: string; invoiceNumber: string };
  serviceIds?: Array<{ _id: string; name: string; price: number; membershipRate?: number }>;
  finalAmount?: number;
  paymentDetails?: { cash?: number; card?: number; upi?: number; other?: number };
  status?: 'Appointment' | 'Checked-In' | 'Checked-Out' | 'Paid' | 'Cancelled' | 'No-Show';
}

export interface CustomerForModal {
  _id: string;
  id: string;
  name: string;
  phoneNumber?: string;
  isMembership?: boolean;
}

export interface StylistForModal {
  _id: string;
  id: string;
  name: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
}

export interface FinalizeBillingPayload {
  appointmentId: string;
  customerId: string;
  stylistId: string;
  billingStaffId: string;
  items: BillLineItem[];
  serviceTotal: number;
  productTotal: number;
  subtotal: number;
  membershipDiscount: number;
  grandTotal: number;
  paymentDetails: { cash: number; card: number; upi: number; other: number };
  notes: string;
  customerWasMember: boolean;
  membershipGrantedDuringBilling: boolean;
  manualDiscountType: 'fixed' | 'percentage' | null;
  manualDiscountValue: number;
  finalManualDiscountApplied: number;
  giftCardRedemption?: {
    cardId: string;
    amount: number;
  };

}

export interface FinalizedInvoice {
  _id: string;
  invoiceNumber: string;
  grandTotal: number;
  paymentDetails: { cash: number; card: number; upi: number; other: number };
  lineItems: BillLineItem[];
  customer: { name: string; };
  stylist: { name: string; };
  billingStaff: { name: string; };
  createdAt: string;
  finalManualDiscountApplied: number;
  membershipDiscount: number;
  issuedGiftCards?: {
    _id: string;
    uniqueCode: string;
    initialBalance: number;
    // Add other fields you might want to display
  }[];
}

export interface BusinessDetails {
  name: string;
  address: string;
  phone: string;
  gstin?: string;
}

export interface BillingTotals {
  serviceTotal: number;
  productTotal: number;
  subtotalBeforeDiscount: number;
  membershipSavings: number;
  calculatedDiscount: number;
  trueGrandTotal: number;
  displayTotal: number;
  refundDue: number;
  totalNewPaid: number;
  balance: number;
  changeDue: number;
}