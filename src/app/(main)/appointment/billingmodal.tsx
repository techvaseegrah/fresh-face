// components/billingmodal.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlusIcon, ClockIcon, EyeIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import { QrCodeIcon } from 'lucide-react';

export interface BillLineItem {
  itemType: 'service' | 'product';
  itemId: string;
  name: string;
  unitPrice: number;
  membershipRate?: number;
  quantity: number;
  finalPrice: number;
}

interface SearchableItem {
  id: string;
  name: string;
  price: number;
  membershipRate?: number;
  type: 'service' | 'product';
}

interface AppointmentForModal {
  id: string;
  serviceIds?: Array<{ _id: string; name: string; price: number; membershipRate?: number }>;
}

interface CustomerForModal {
  id: string;
  name: string;
  phoneNumber?: string;
  isMembership?: boolean;
}

interface StylistForModal {
  id: string;
  name: string;
}

interface StaffMember {
  _id: string;
  name: string;
  email: string;
}

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentForModal;
  customer: CustomerForModal;
  stylist: StylistForModal;
  onFinalizeAndPay: (
    appointmentId: string,
    finalTotal: number,
    billDetails: any
  ) => Promise<void>;
}

// === CUSTOMER HISTORY MODAL FOR BILLING ===
const CustomerHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerForModal | null;
}> = ({ isOpen, onClose, customer }) => {
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && customer?.phoneNumber) {
      fetchCustomerHistory();
    }
  }, [isOpen, customer]);

  const fetchCustomerHistory = async () => {
    if (!customer?.phoneNumber) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/customer/search?query=${customer.phoneNumber}&details=true`);
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomerDetails(data.customer);
      }
    } catch (error) {
      console.error('Failed to fetch customer history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Appointment': return 'bg-blue-100 text-blue-800';
      case 'Checked-In': return 'bg-yellow-100 text-yellow-800';
      case 'Checked-Out': return 'bg-purple-100 text-purple-800';
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'No-Show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold">Customer History - {customer?.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading history...</div>
        ) : customerDetails ? (
          <div>
            {/* Customer Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{customerDetails.appointmentHistory.length}</div>
                <div className="text-sm text-gray-600">Total Visits</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ₹{customerDetails.appointmentHistory
                    .filter((apt: any) => apt.status === 'Paid')
                    .reduce((sum: number, apt: any) => sum + apt.totalAmount, 0)
                    .toFixed(0)}
                </div>
                <div className="text-sm text-gray-600">Total Spent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{customerDetails.loyaltyPoints || 0}</div>
                <div className="text-sm text-gray-600">Loyalty Points</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${customerDetails.isMember ? 'text-green-600' : 'text-gray-400'}`}>
                  {customerDetails.isMember ? 'YES' : 'NO'}
                </div>
                <div className="text-sm text-gray-600">Member</div>
              </div>
            </div>

            {/* History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Services</th>
                    <th className="px-4 py-2 text-left">Stylist</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {customerDetails.appointmentHistory.map((apt: any) => (
                    <tr key={apt._id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {new Date(apt.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">{apt.services.join(', ') || 'N/A'}</td>
                      <td className="px-4 py-3">{apt.stylistName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apt.status)}`}>
                          {apt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">₹{apt.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No history found</div>
        )}
      </div>
    </div>
  );
};

const BillingModal: React.FC<BillingModalProps> = ({
  isOpen,
  onClose,
  appointment,
  customer,
  stylist,
  onFinalizeAndPay
}) => {
  const [billItems, setBillItems] = useState<BillLineItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

const [inventoryImpact, setInventoryImpact] = useState<any>(null);
const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchableItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Membership and history states
  const [customerIsMember, setCustomerIsMember] = useState<boolean>(false);
  const [showMembershipGrant, setShowMembershipGrant] = useState<boolean>(false);
  const [membershipGranted, setMembershipGranted] = useState<boolean>(false);
  const [showCustomerHistory, setShowCustomerHistory] = useState<boolean>(false);

  // STAFF SELECTION
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isLoadingStaff, setIsLoadingStaff] = useState<boolean>(false);

  // SPLIT PAYMENT STATES
  const [paymentDetails, setPaymentDetails] = useState({
    cash: 0,
    card: 0,
    upi: 0,
    other: 0
  });

  // ADD BARCODE STATES FOR MEMBERSHIP GRANT
  const [membershipBarcode, setMembershipBarcode] = useState<string>('');
  const [isBarcodeValid, setIsBarcodeValid] = useState<boolean>(true);
  const [isCheckingBarcode, setIsCheckingBarcode] = useState<boolean>(false);

  // Load staff members when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStaffMembers();
    }
  }, [isOpen]);

  useEffect(() => {
  if (billItems.length > 0 && appointment.serviceIds) {
    fetchInventoryImpact();
  }
}, [billItems, appointment.serviceIds, customer._id]);

const fetchInventoryImpact = async () => {
  setIsLoadingInventory(true);
  try {
    const serviceIds = appointment.serviceIds?.map(s => s._id) || [];
    const response = await fetch('/api/billing/inventory-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceIds,
        customerId: customer._id
      })
    });

    const data = await response.json();
    if (data.success) {
      setInventoryImpact(data.data);
    }

    console.log('🔥 Inventory impact fetched:', data.data);
    
  } catch (error) {
    console.error('Failed to fetch inventory impact:', error);
  } finally {
    setIsLoadingInventory(false);
  }
};


  const fetchStaffMembers = async () => {
    setIsLoadingStaff(true);
    try {
      const res = await fetch('/api/users/billing-staff');
      const data = await res.json();
      if (data.success) {
        setAvailableStaff(data.staff);
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  // === INITIALIZE BILL ITEMS PROPERLY ===
  useEffect(() => {
    if (isOpen && appointment) {
      console.log('🔥 Initializing billing modal with appointment:', appointment);

      // Reset all states
      setError(null);
      setNotes('');
      setSearchQuery('');
      setSearchResults([]);
      setMembershipGranted(false);
      setSelectedStaffId('');
      setPaymentDetails({ cash: 0, card: 0, upi: 0, other: 0 });

      // Set customer membership status
      const isMember = customer?.isMembership || false;
      setCustomerIsMember(isMember);
      setShowMembershipGrant(!isMember);

      // === CRITICAL FIX: PROPERLY INITIALIZE BILL ITEMS ===
      if (appointment.serviceIds && appointment.serviceIds.length > 0) {
        const initialItems = appointment.serviceIds.map(service => {
          console.log('🔥 Processing service for bill:', service);

          const hasDiscount = isMember && service.membershipRate;
          const finalPrice = hasDiscount ? service.membershipRate : service.price;

          return {
            itemType: 'service' as const,
            itemId: service._id,
            name: service.name,
            unitPrice: service.price,
            membershipRate: service.membershipRate,
            quantity: 1,
            finalPrice: finalPrice
          };
        });

        console.log('🔥 Setting initial bill items:', initialItems);
        setBillItems(initialItems);
      } else {
        console.log('🔥 No services found in appointment');
        setBillItems([]);
      }
    } else {
      // Reset when modal is closed
      setBillItems([]);
    }
  }, [isOpen, appointment, customer?.isMembership]);

  // Recalculate prices when membership status changes
  useEffect(() => {
    setBillItems(prevItems =>
      prevItems.map(item => {
        if (item.itemType === 'service' && customerIsMember && item.membershipRate) {
          return { ...item, finalPrice: item.membershipRate * item.quantity };
        }
        return { ...item, finalPrice: item.unitPrice * item.quantity };
      })
    );
  }, [customerIsMember]);

  // Search for additional items
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/billing/search-items?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success) setSearchResults(data.items);
      } catch (e) {
        console.error('Item search failed:', e);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Validate barcode as user types
  useEffect(() => {
    if (!membershipBarcode.trim()) {
      setIsBarcodeValid(true);
      return;
    }

    const handler = setTimeout(async () => {
      setIsCheckingBarcode(true);
      try {
        const res = await fetch(`/api/customer/check-barcode?barcode=${encodeURIComponent(membershipBarcode.trim())}`);
        const data = await res.json();
        setIsBarcodeValid(!data.exists);
      } catch (error) {
        console.error('Failed to check barcode:', error);
        setIsBarcodeValid(false);
      } finally {
        setIsCheckingBarcode(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [membershipBarcode]);

  const handleAddItemToBill = (item: SearchableItem) => {
    if (billItems.some(bi => bi.itemId === item.id)) return;

    const isService = item.type === 'service';
    const hasDiscount = customerIsMember && isService && item.membershipRate;
    const finalPrice = hasDiscount ? item.membershipRate! : item.price;

    const newItem: BillLineItem = {
      itemType: item.type,
      itemId: item.id,
      name: item.name,
      unitPrice: item.price,
      membershipRate: item.membershipRate,
      quantity: 1,
      finalPrice: finalPrice
    };

    setBillItems(prev => [...prev, newItem]);
    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const handleRemoveItem = (indexToRemove: number) => {
    setBillItems(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;

    setBillItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const isService = item.itemType === 'service';
        const hasDiscount = customerIsMember && isService && item.membershipRate;
        const unitPrice = hasDiscount ? item.membershipRate! : item.unitPrice;

        return {
          ...item,
          quantity: newQuantity,
          finalPrice: unitPrice * newQuantity
        };
      }
      return item;
    }));
  };

  const handleGrantMembership = async () => {
    if (!membershipBarcode.trim()) {
      setError('Please enter a barcode for the membership.');
      return;
    }

    if (!isBarcodeValid) {
      setError('This barcode is already in use. Please enter a different one.');
      return;
    }

    try {
      const response = await fetch(`/api/customer/${customer._id}/toggle-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isMembership: true,
          membershipBarcode: membershipBarcode.trim()
        })
      });

      const result = await response.json();
      if (result.success) {
        setCustomerIsMember(true);
        setShowMembershipGrant(false);
        setMembershipGranted(true);
        setMembershipBarcode('');
        toast.success(`Membership granted with barcode: ${result.customer.membershipBarcode}`);
      } else {
        setError(result.message || 'Failed to grant membership');
      }
    } catch (err) {
      console.error('Failed to grant membership:', err);
      setError('Failed to grant membership');
    }
  };


  // Handle payment amount changes
  const handlePaymentChange = (method: keyof typeof paymentDetails, amount: number) => {
    setPaymentDetails(prev => ({
      ...prev,
      [method]: Math.max(0, amount)
    }));
  };



  const calculateTotals = useCallback(() => {
    let serviceTotal = 0;
    let productTotal = 0;
    let originalTotal = 0;
    let membershipSavings = 0;

    billItems.forEach(item => {
      const isService = item.itemType === 'service';

      if (isService) {
        serviceTotal += item.finalPrice;
        originalTotal += item.unitPrice * item.quantity;

        if (customerIsMember && item.membershipRate) {
          membershipSavings += (item.unitPrice - item.membershipRate) * item.quantity;
        }
      } else {
        productTotal += item.finalPrice;
        originalTotal += item.unitPrice * item.quantity;
      }
    });

    const grandTotal = serviceTotal + productTotal;
    const totalPaid = Object.values(paymentDetails).reduce((sum, amount) => sum + amount, 0);
    const balance = grandTotal - totalPaid;

    return {
      serviceTotal,
      productTotal,
      originalTotal,
      grandTotal,
      membershipSavings,
      totalPaid,
      balance
    };
  }, [billItems, customerIsMember, paymentDetails]);

  const { serviceTotal, productTotal, originalTotal, grandTotal, membershipSavings, totalPaid, balance } = calculateTotals();

  const handleFinalizeClick = async () => {
    if (billItems.length === 0) {
      setError('Cannot finalize an empty bill.');
      return;
    }

    if (grandTotal <= 0) {
      setError('Bill total must be greater than zero.');
      return;
    }

    if (!selectedStaffId) {
      setError('Please select a billing staff member.');
      return;
    }

    if (Math.abs(balance) > 0.01) { // Allow for small floating point differences
      setError(`Payment amount (₹${totalPaid.toFixed(2)}) does not match bill total (₹${grandTotal.toFixed(2)}). Balance: ₹${balance.toFixed(2)}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const billDetails = {
        items: billItems.map(item => ({
          itemType: item.itemType,
          itemId: item.itemId,
          name: item.name,
          unitPrice: item.unitPrice,
          membershipRate: item.membershipRate,
          quantity: item.quantity,
          finalPrice: item.finalPrice,
          membershipDiscount: item.membershipRate && customerIsMember ?
            (item.unitPrice - item.membershipRate) * item.quantity : 0
        })),
        serviceTotal,
        productTotal,
        subtotal: originalTotal,
        membershipDiscount: membershipSavings,
        grandTotal,
        paymentDetails,
        notes,
        stylistId: stylist.id,
        billingStaffId: selectedStaffId,
        customerWasMember: customer?.isMembership || false,
        membershipGrantedDuringBilling: membershipGranted
      };

      console.log('🔥 Finalizing bill with details:', billDetails);
      await onFinalizeAndPay(appointment._id, grandTotal, billDetails);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  console.log('🔥 Rendering billing modal with bill items:', billItems);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 pb-3 border-b">
            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">
                  Bill for: <span className="text-indigo-600">{customer.name}</span>
                </h2>
                {customer.phoneNumber && (
                  <button
                    onClick={() => setShowCustomerHistory(true)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View Customer History"
                  >
                    <ClockIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Service by: <span className="font-medium">{stylist.name}</span>
                {customerIsMember && (
                  <span className="ml-3 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-semibold">
                    Member Pricing Applied
                  </span>
                )}
                {membershipGranted && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-semibold">
                    Membership Granted
                  </span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 text-2xl hover:text-gray-700">
              &times;
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 p-3 bg-red-100 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {showMembershipGrant && !customerIsMember && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Grant Membership?</p>
                    <p className="text-xs text-yellow-700">Customer will get discounted rates on all services</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-yellow-800 mb-1">
                      Membership Barcode <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={membershipBarcode}
                        onChange={(e) => setMembershipBarcode(e.target.value)}
                        placeholder="Enter barcode (e.g., MEMBER001, ABC123)"
                        className={`w-full px-3 py-2 pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 ${!isBarcodeValid
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                          }`}
                      />
                      <QrCodeIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                    {isCheckingBarcode && (
                      <p className="text-xs text-gray-500 mt-1">Checking barcode availability...</p>
                    )}
                    {!isBarcodeValid && membershipBarcode.trim() && (
                      <p className="text-xs text-red-600 mt-1">This barcode is already in use</p>
                    )}
                    {isBarcodeValid && membershipBarcode.trim() && (
                      <p className="text-xs text-green-600 mt-1">Barcode is available</p>
                    )}
                  </div>

                  <button
                    onClick={handleGrantMembership}
                    disabled={!membershipBarcode.trim() || !isBarcodeValid || isCheckingBarcode}
                    className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <UserPlusIcon className="w-4 h-4" />
                    Grant Membership
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-grow overflow-y-auto pr-2 space-y-4">
            {/* === CURRENT BILL ITEMS SECTION === */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">
                Current Bill Items ({billItems.length})
              </h3>

              {billItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
                  <p className="text-lg">No items in bill</p>
                  <p className="text-sm">Services from appointment should appear here automatically</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">Item</th>
                        <th className="px-4 py-3 text-center">Qty</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billItems.map((item, idx) => {
                        const isService = item.itemType === 'service';
                        const hasDiscount = customerIsMember && isService && item.membershipRate;
                        const unitPrice = hasDiscount ? item.membershipRate! : item.unitPrice;
                        const savings = hasDiscount ? (item.unitPrice - item.membershipRate!) * item.quantity : 0;

                        return (
                          <tr key={`${item.itemId}-${idx}`} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <span className="font-medium">{item.name}</span>
                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${isService ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                  }`}>
                                  {item.itemType}
                                </span>
                              </div>
                              {savings > 0 && (
                                <div className="text-xs text-green-600 mt-1">
                                  <span className="line-through text-gray-400">₹{item.unitPrice}</span>
                                  <span className="ml-2 bg-green-100 px-1 rounded text-green-700">
                                    Save ₹{savings.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              ₹{unitPrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              ₹{item.finalPrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="text-red-500 hover:text-red-700 text-xs px-2 py-1 hover:bg-red-50 rounded"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

{inventoryImpact && inventoryImpact.inventoryImpact.length > 0 && (
  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      Inventory Impact ({inventoryImpact.customerGender === 'other' ? 'Default' : inventoryImpact.customerGender.charAt(0).toUpperCase() + inventoryImpact.customerGender.slice(1)} quantities)
    </h4>
    
    <div className="space-y-2">
      {inventoryImpact.inventoryImpact.map((impact: any, index: number) => (
        <div key={index} className={`p-3 rounded-md border ${
          impact.alertLevel === 'insufficient' ? 'bg-red-50 border-red-200' :
          impact.alertLevel === 'critical' ? 'bg-orange-50 border-orange-200' :
          impact.alertLevel === 'low' ? 'bg-yellow-50 border-yellow-200' :
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <span className="font-medium text-sm">{impact.productName}</span>
              <div className="text-xs text-gray-600">
                Current: {impact.currentQuantity.toFixed(1)}{impact.unit} → 
                After service: {impact.remainingAfterUsage.toFixed(1)}{impact.unit}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">-{impact.usageQuantity.toFixed(1)}{impact.unit}</div>
              {impact.alertLevel !== 'ok' && (
                <div className={`text-xs font-medium ${
                  impact.alertLevel === 'insufficient' ? 'text-red-600' :
                  impact.alertLevel === 'critical' ? 'text-orange-600' :
                  'text-yellow-600'
                }`}>
                  {impact.alertLevel === 'insufficient' ? 'Insufficient Stock!' :
                   impact.alertLevel === 'critical' ? 'Critical Level' :
                   'Low Stock'}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

            {/* Search for Additional Items */}
            <div className="border-t pt-4">
              <label htmlFor="itemSearch" className="block text-sm font-medium text-gray-700 mb-1">
                Add Additional Services/Products
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  id="itemSearch"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search for additional items..."
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
                {(isSearching || searchResults.length > 0) && (
                  <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {isSearching && (
                      <li className="px-3 py-2 text-sm text-gray-500">Searching...</li>
                    )}
                    {!isSearching && searchResults.map(item => (
                      <li
                        key={item.id}
                        onClick={() => handleAddItemToBill(item)}
                        className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span>{item.name}</span>
                            <span className={`text-xs ml-2 px-1.5 py-0.5 rounded-full ${item.type === 'service'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                              }`}>
                              {item.type}
                            </span>
                          </div>
                          <div className="text-right">
                            <div>₹{item.price.toFixed(2)}</div>
                            {customerIsMember && item.membershipRate && item.type === 'service' && (
                              <div className="text-xs text-green-600">
                                Member: ₹{item.membershipRate.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                    {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
                      <li className="px-3 py-2 text-sm text-gray-500">No items found.</li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* BILLING STAFF SELECTION */}
            <div className="pt-4 border-t">
              <label htmlFor="billingStaff" className="block text-sm font-medium text-gray-700 mb-1">
                Billing Staff <span className="text-red-500">*</span>
              </label>
              <select
                id="billingStaff"
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoadingStaff}
              >
                <option value="">
                  {isLoadingStaff ? 'Loading staff...' : 'Select billing staff'}
                </option>
                {availableStaff.map(staff => (
                  <option key={staff._id} value={staff._id}>
                    {staff.name} ({staff.email})
                  </option>
                ))}
              </select>
            </div>

            {/* SPLIT PAYMENT SECTION */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cash</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentDetails.cash}
                    onChange={e => handlePaymentChange('cash', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Card</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentDetails.card}
                    onChange={e => handlePaymentChange('card', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">UPI</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentDetails.upi}
                    onChange={e => handlePaymentChange('upi', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Other</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentDetails.other}
                    onChange={e => handlePaymentChange('other', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Payment Summary */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Total Paid:</span>
                  <span className="font-semibold">₹{totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Bill Total:</span>
                  <span className="font-semibold">₹{grandTotal.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between text-sm mt-1 ${balance === 0 ? 'text-green-600' : balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  <span>Balance:</span>
                  <span className="font-bold">₹{balance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label htmlFor="billingNotes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="billingNotes"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          {/* Footer with Totals */}
          <div className="mt-auto pt-4 border-t">
            <div className="grid grid-cols-2 gap-8">
              {/* Totals Breakdown */}
              <div className="space-y-2 text-sm">
                {serviceTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Services:</span>
                    <span>₹{serviceTotal.toFixed(2)}</span>
                  </div>
                )}
                {productTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Products:</span>
                    <span>₹{productTotal.toFixed(2)}</span>
                  </div>
                )}
                {membershipSavings > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal:</span>
                      <span>₹{originalTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Membership Savings:</span>
                      <span>-₹{membershipSavings.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Grand Total */}
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  <div>Grand Total:</div>
                  <div className="text-green-600">₹{grandTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizeClick}
                className="px-6 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 min-w-[120px]"
                disabled={isLoading || billItems.length === 0 || grandTotal <= 0 || !selectedStaffId || Math.abs(balance) > 0.01}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Processing...
                  </div>
                ) : (
                  `Complete Payment ₹${grandTotal.toFixed(2)}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer History Modal */}
      <CustomerHistoryModal
        isOpen={showCustomerHistory}
        onClose={() => setShowCustomerHistory(false)}
        customer={customer}
      />
    </>
  );
};

export default BillingModal;