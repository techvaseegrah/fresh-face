export interface AppointmentHistoryItem {
  _id: string;
  id: string;
  service: string;
  date: string;
  status: string;
  services: string[];
  totalAmount: number;
  stylistName: string;
}

export interface MembershipUIDetails {
  planName: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface CrmCustomer {
  isMembership?: boolean;
  id: string;
  _id: string;
  name: string;
  email?: string;
  phoneNumber: string;
  createdAt?: string;
  status?: 'Active' | 'Inactive' | 'New';
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  survey?: string;
  appointmentHistory?: AppointmentHistoryItem[];
  currentMembership?: MembershipUIDetails | null;
  loyaltyPoints?: number;
  membershipBarcode?: string;
  isActive?: boolean;
}

export interface MembershipPlanFE {
  _id: string;
  id: string;
  name: string;
  price: number;
  durationDays: number;
}

export interface AddCustomerFormData {
  name: string;
  email?: string;
  phoneNumber: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  survey?: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCustomers: number;
  limit: number;
}

// --- START: Added for Packages Module ---

/**
 * Represents a single remaining item within a customer's package.
 * This matches the enriched data sent from the backend API.
 */
export interface CustomerPackageRemainingItem {
  itemType: 'service' | 'product';
  itemId: string; // ObjectId as a string on the frontend
  totalQuantity: number;
  remainingQuantity: number;
  itemName: string; // The populated name of the service/product
}

/**
 * Represents a package that has been sold to a customer.
 * This is the primary type used by the CustomerPackageList component.
 */
export interface CustomerPackage {
  _id: string;
  customerId: string;
  packageName: string;
  purchaseDate: string; // ISO date string
  expiryDate: string;   // ISO date string
  status: 'active' | 'completed' | 'expired';
  remainingItems: CustomerPackageRemainingItem[];
}

// --- END: Added for Packages Module ---