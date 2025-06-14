'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ===================================================================================
//  INTERFACES & TYPE DEFINITIONS
// ===================================================================================

export interface BillLineItem {
  itemType: 'service' | 'product' | 'membership';
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  finalPrice: number;
}
interface SearchableItem { id: string; name: string; price: number; type: 'service' | 'product'; }
export interface MembershipPlanFE { _id: string; id: string; name: string; price: number; durationDays: number; }
interface AppointmentForModal { id: string; serviceIds?: Array<{ _id: string, name: string, price: number }>; }
interface CustomerForModal { id: string; name: string; }
interface StylistForModal { id: string; name: string; }

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentForModal;
  customer: CustomerForModal;
  stylist: StylistForModal;
  onFinalizeAndPay: (appointmentId: string, finalTotal: number, billDetails: any) => Promise<void>;
}


// ===================================================================================
//  COMPONENT
// ===================================================================================

const BillingModal: React.FC<BillingModalProps> = ({
  isOpen,
  onClose,
  appointment,
  customer,
  stylist,
  onFinalizeAndPay,
}) => {
  const [billItems, setBillItems] = useState<BillLineItem[]>([]);
  const [availableMembershipPlans, setAvailableMembershipPlans] = useState<MembershipPlanFE[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Card');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchableItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (isOpen && appointment) {
      const initialItems: BillLineItem[] = (appointment.serviceIds || []).map(service => ({
        itemType: 'service', itemId: service._id, name: service.name,
        unitPrice: service.price, quantity: 1, finalPrice: service.price,
      }));
      setBillItems(initialItems);
      setError(null); setNotes(''); setPaymentMethod('Card');
      setSearchQuery(''); setSearchResults([]); setSelectedPlanId('');
    }
  }, [isOpen, appointment]);

  useEffect(() => {
    if (isOpen) {
      const fetchPlans = async () => { 
        try{
          const response = await fetch(`/api/membership-plans`)
          const data = await response.json()
          if(response.ok && data.success){
           setAvailableMembershipPlans(data.plans);
          }
          else{
            console.log("failed to fetch membership-plans:",data.message)
          }
        }
        catch(error){
          console.log(error)
        }
      };
      fetchPlans();
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/billing/search-items?query=${searchQuery}`);
        const data = await res.json();
        if (data.success) setSearchResults(data.items);
      } catch (e) { console.error("Item search failed:", e); }
      finally { setIsSearching(false); }
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // --- Event Handlers ---
  const handleAddItemToBill = (item: SearchableItem) => {
    if (billItems.some(bi => bi.itemId === item.id)) return;
    const newItem: BillLineItem = {
      itemType: item.type, itemId: item.id, name: item.name,
      unitPrice: item.price, quantity: 1, finalPrice: item.price,
    };
    setBillItems(prev => [...prev, newItem]);
    setSearchQuery(''); setSearchResults([]); searchInputRef.current?.focus();
  };
  const handleRemoveItem = (indexToRemove: number) => {
    setBillItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };
  const handleMembershipSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const planId = e.target.value;
    setSelectedPlanId(planId);
    let newBillItems = billItems.filter(item => item.itemType !== 'membership');
    if (planId) {
      const selectedPlan = availableMembershipPlans.find(p => p._id === planId);
      if (selectedPlan) {
        newBillItems.push({ itemType: 'membership', itemId: selectedPlan._id, name: `Membership: ${selectedPlan.name}`, unitPrice: selectedPlan.price, quantity: 1, finalPrice: selectedPlan.price });
      }
    }
    setBillItems(newBillItems);
  };
  const calculateTotals = useCallback(() => ({ grandTotal: billItems.reduce((sum, item) => sum + item.finalPrice, 0) }), [billItems]);
  const { grandTotal } = calculateTotals();

  const handleFinalizeClick = async () => {
    if (billItems.length === 0) { setError("Cannot finalize an empty bill."); return; }
    setIsLoading(true); setError(null);
    try {
      const billDetails = {
        items: billItems.map(item => ({ itemType: item.itemType, itemId: item.itemId, name: item.name, unitPrice: item.unitPrice, quantity: item.quantity, finalPrice: item.finalPrice })),
        paymentMethod,
        notes,
        purchasedMembershipPlanId: selectedPlanId || undefined,
        stylistId: stylist.id, // <-- This is the crucial line
      };
      await onFinalizeAndPay(appointment.id, grandTotal, billDetails);
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-3 border-b">
          <div>
            <h2 className="text-xl font-semibold">Bill for: <span className="text-indigo-600">{customer?.name}</span></h2>
            <p className="text-sm text-gray-500 mt-1">Service by: <span className="font-medium">{stylist?.name || 'N/A'}</span></p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 text-2xl hover:text-gray-700">×</button>
        </div>

        {error && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          <div className="pt-2">
            <label htmlFor="itemSearch" className="block text-sm font-medium text-gray-700 mb-1">Add Another Service/Product</label>
            <div className="relative"><input ref={searchInputRef} id="itemSearch" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Start typing to search..." className="w-full px-3 py-2 border border-gray-300 rounded-md" autoComplete="off"/>
              {(isSearching || searchResults.length > 0) && (<ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">{isSearching && <li className="px-3 py-2 text-sm text-gray-500">Searching...</li>}{!isSearching && searchResults.map(item => (<li key={item.id} onClick={() => handleAddItemToBill(item)} className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer flex justify-between"><span>{item.name} <span className={`text-xs ml-2 px-1.5 py-0.5 rounded-full ${item.type === 'service' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{item.type}</span></span><span>₹{item.price.toFixed(2)}</span></li>))}{!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && <li className="px-3 py-2 text-sm text-gray-500">No items found.</li>}</ul>)}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2 mt-4 border-t pt-4">Current Bill Items</h3>
            {billItems.length === 0 && <p className="text-gray-500 text-sm italic">No items added yet.</p>}
            <ul className="space-y-2">
              {billItems.map((item, index) => (
                <li key={`${item.itemId}-${index}`} className="p-2.5 border rounded-md flex justify-between items-center text-sm bg-gray-50">
                  <span className="font-medium text-gray-700">{item.name}</span>
                  <div className="flex items-center"><span className="text-gray-800 mr-3">₹{item.finalPrice.toFixed(2)}</span><button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 text-xs p-1">Remove</button></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-4 border-t">
            <label htmlFor="membershipPlan" className="block text-sm font-medium text-gray-700 mb-1">Add Membership (Optional)</label>
            <select id="membershipPlan" value={selectedPlanId} onChange={handleMembershipSelectionChange} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-black"><option value="">-- No Membership --</option>{availableMembershipPlans.map(plan => (<option key={plan._id} value={plan._id}>{plan.name} - ₹{plan.price.toFixed(2)}</option>))}</select>
          </div>
          <div className="pt-4 border-t"><label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">Payment Method:</label><select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-white text-black"><option value="Card">Card</option><option value="Cash">Cash</option><option value="UPI">UPI / Digital Wallet</option><option value="Other">Other</option></select></div>
          <div className="mt-4"><label htmlFor="billingNotes" className="block text-sm font-medium text-gray-700 mb-1">Notes:</label><textarea id="billingNotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-md"/></div>
        </div>

        <div className="mt-auto pt-4 border-t flex-shrink-0">
          <div className="flex justify-between text-lg font-bold text-gray-900 mt-2"><p>Grand Total:</p><p>₹{grandTotal.toFixed(2)}</p></div>
        </div>
        <div className="mt-6 flex justify-end space-x-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300" disabled={isLoading}>Cancel</button>
          <button type="button" onClick={handleFinalizeClick} className="px-6 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50" disabled={isLoading || billItems.length === 0}>{isLoading ? 'Processing...' : 'Finalize & Pay'}</button>
        </div>
      </div>
    </div>
  );
};

export default BillingModal;