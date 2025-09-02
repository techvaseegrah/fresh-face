// Using 'any' for ObjectId for simplicity on the frontend, as it's typically a string.
// In a stricter setup, you might create a specific string type.
export interface PackageTemplateItem {
  itemType: 'service' | 'product';
  itemId: any;
  quantity: number;
  itemName?: string;
}

export interface PackageTemplate {
  _id: string;
  name: string;
  description?: string;
  price: number;
  items: PackageTemplateItem[];
  validityInDays: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Minimal types for fetching services and products for the modal dropdowns
export interface SelectableItem {
  _id: string;
  name: string;
}