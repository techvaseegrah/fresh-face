// components/billingmodal.tsx - FIXED VERSION WITH PROPER BILL DISPLAY
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlusIcon, ClockIcon, EyeIcon } from '@heroicons/react/24/solid';

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
  const [paymentMethod, setPaymentMethod] = useState<string>('Card');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchableItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Membership and history states
  const [customerIsMember, setCustomerIsMember] = useState<boolean>(false);
  const [showMembershipGrant, setShowMembershipGrant] = useState<boolean>(false);
  const [membershipGranted, setMembershipGranted] = useState<boolean>(false);
  const [showCustomerHistory, setShowCustomerHistory] = useState<boolean>(false);

  // === FIX: INITIALIZE BILL ITEMS PROPERLY ===
  useEffect(() => {
    if (isOpen && appointment) {
      console.log('🔥 Initializing billing modal with appointment:', appointment);

      // Reset all states
      setError(null);
      setNotes('');
      setPaymentMethod('Card');
      setSearchQuery('');
      setSearchResults([]);
      setMembershipGranted(false);

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
    try {
      const response = await fetch(`/api/customer/${customer.id}/toggle-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMembership: true })
      });

      const result = await response.json();
      if (result.success) {
        setCustomerIsMember(true);
        setShowMembershipGrant(false);
        setMembershipGranted(true);
      }
    } catch (err) {
      console.error('Failed to grant membership:', err);
    }
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

    return {
      serviceTotal,
      productTotal,
      originalTotal,
      grandTotal,
      membershipSavings
    };
  }, [billItems, customerIsMember]);

  const { serviceTotal, productTotal, originalTotal, grandTotal, membershipSavings } = calculateTotals();

  const handleFinalizeClick = async () => {
    if (billItems.length === 0) {
      setError('Cannot finalize an empty bill.');
      return;
    }

    if (grandTotal <= 0) {
      setError('Bill total must be greater than zero.');
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
        paymentMethod,
        notes,
        stylistId: stylist.id,
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
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 pb-3 border-b">
            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">
                  Bill for: <span className="text-indigo-600">{customer.name}</span>
                </h2>
                {/* === ADD HISTORY BUTTON IN HEADER === */}
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

          {/* Membership Grant Option */}
          {showMembershipGrant && !customerIsMember && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800">Grant Membership?</p>
                  <p className="text-xs text-yellow-700">Customer will get discounted rates on services</p>
                </div>
                <button
                  onClick={handleGrantMembership}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 flex items-center gap-1"
                >
                  <UserPlusIcon className="w-4 h-4" />
                  Grant Membership
                </button>
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

            {/* Payment Method */}
            <div className="pt-4 border-t">
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / Digital Wallet</option>
                <option value="Other">Other</option>
              </select>
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
                disabled={isLoading || billItems.length === 0 || grandTotal <= 0}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Processing...
                  </div>
                ) : (
                  `Pay ₹${grandTotal.toFixed(2)}`
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