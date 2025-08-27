// Interface for a single budget item (e.g., Salon Rent, Marketing)
export interface IBudgetItem {
    _id?: string;
    category: string;
    amount: number;
    type: 'Fixed' | 'Variable';
  }
  
  // Interface for the full budget document fetched from the API
  export interface IBudget {
    _id: string;
    tenantId: string;
    branch: string;
    month: number;
    year: number;
    fixedExpenses: IBudgetItem[];
    variableExpenses: IBudgetItem[];
  }
  
  // Interface for the data displayed on the tracking dashboard
  export interface ITrackerData {
    category: string;
    type: 'Fixed' | 'Variable';
    budget: number;
    spentTillDate: number;
    remainingBudget: number;
    budgetUsedIn: string; // e.g., "80%"
    budgetRemainingIn: string; // e.g., "20%"
  }