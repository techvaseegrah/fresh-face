'use client';
import React, { useState, useEffect } from 'react';
import { UserCircleIcon, QrCodeIcon, GiftIcon, TagIcon, CalendarDaysIcon, SparklesIcon, EyeIcon, ClockIcon, BanknotesIcon } from '@heroicons/react/24/solid';
import { formatDateIST } from '@/lib/dateFormatter';
import { CustomerDetails, AppointmentHistory } from './types';

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

interface CustomerDetailPanelProps {
  customer: CustomerDetails | null;
  isLoading: boolean;
  onToggleMembership: (customBarcode?: string) => void;
  onViewFullHistory: () => void;
  tenantId: string | undefined;
}

const CustomerDetailPanel: React.FC<CustomerDetailPanelProps> = ({ customer, isLoading, onToggleMembership, onViewFullHistory, tenantId }) => {
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [membershipBarcode, setMembershipBarcode] = useState('');
  const [isBarcodeValid, setIsBarcodeValid] = useState(true);
  const [isCheckingBarcode, setIsCheckingBarcode] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');

  useEffect(() => {
    if (!membershipBarcode.trim()) { setIsBarcodeValid(true); setBarcodeError(''); return; }
    const barcodeRegex = /^[A-Z0-9-_]{3,20}$/i;
    if (!barcodeRegex.test(membershipBarcode.trim())) { setIsBarcodeValid(false); setBarcodeError('Barcode must be 3-20 characters (letters, numbers, hyphens, underscores only)'); return; }
    const handler = setTimeout(async () => {
      if (!tenantId) { setBarcodeError('Cannot validate barcode: tenant not identified.'); return; }
      setIsCheckingBarcode(true); setBarcodeError('');
      try {
        const res = await fetch(`/api/customer/check-barcode?barcode=${encodeURIComponent(membershipBarcode.trim())}`, { headers: { 'x-tenant-id': tenantId } });
        const data = await res.json();
        if (data.success) {
          setIsBarcodeValid(!data.exists);
          if (data.exists) setBarcodeError('This barcode is already in use');
        } else { setIsBarcodeValid(false); setBarcodeError('Failed to validate barcode'); }
      } catch (error) { setIsBarcodeValid(false); setBarcodeError('Network error while checking barcode'); }
      finally { setIsCheckingBarcode(false); }
    }, 500);
    return () => clearTimeout(handler);
  }, [membershipBarcode, tenantId]);

  const handleGrantMembership = () => {
    if (showBarcodeInput) {
      if (!membershipBarcode.trim()) { setBarcodeError('Please enter a barcode'); return; }
      if (!isBarcodeValid) return;
      onToggleMembership(membershipBarcode.trim());
      setMembershipBarcode(''); setShowBarcodeInput(false); setBarcodeError('');
    } else { setShowBarcodeInput(true); }
  };
  const handleCancelBarcodeInput = () => { setShowBarcodeInput(false); setMembershipBarcode(''); setBarcodeError(''); setIsBarcodeValid(true); };
  if (isLoading) { return ( <div className="animate-pulse space-y-4 h-full"><div className="h-8 bg-gray-200 rounded-md w-3/4" /><div className="h-5 bg-gray-200 rounded-md w-1/2" /><div className="h-24 bg-gray-100 rounded-lg mt-6" /><div className="h-32 bg-gray-100 rounded-lg" /><div className="space-y-3"><div className="h-20 bg-gray-100 rounded-lg" /><div className="h-20 bg-gray-100 rounded-lg" /><div className="h-20 bg-gray-100 rounded-lg" /></div></div> ); }
  if (!customer) { return ( <div className="text-center text-gray-500 h-full flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg"><UserCircleIcon className="w-16 h-16 text-gray-300 mb-4" /><h3 className="font-semibold text-gray-700 mb-2">Customer Details</h3><p className="text-sm text-center">Enter a phone number or scan a barcode to look up an existing customer.</p><div className="mt-4 flex items-center gap-2 text-xs text-gray-500"><QrCodeIcon className="w-4 h-4" /><span>Members can use barcode for quick lookup</span></div></div> ); }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900">{customer.name}</h3>
        <button onClick={onViewFullHistory} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Complete History"><EyeIcon className="w-5 h-5" /></button>
      </div>
      <div className="space-y-3 text-sm mb-6">
        <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
            {!customer.isMember && !showBarcodeInput && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-grow"><div className="flex items-center gap-2 mb-1"><GiftIcon className="w-5 h-5 text-yellow-600" /><span className="font-semibold text-yellow-800">Membership Status</span></div><p className="text-sm text-yellow-700">Grant membership for special pricing and barcode access</p></div>
                    <button onClick={handleGrantMembership} className="px-3 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 transition-colors text-center w-full sm:w-32 shrink-0">Grant Membership</button>
                </div>
            )}
            {showBarcodeInput && !customer.isMember && ( <div className="space-y-3"><div><label className="block text-sm font-medium text-yellow-800 mb-1">Membership Barcode <span className="text-red-500">*</span></label><div className="relative"><input type="text" value={membershipBarcode} onChange={(e) => setMembershipBarcode(e.target.value.toUpperCase())} placeholder="Enter barcode (e.g., MEMBER001, ABC123)" className={`w-full px-3 py-2 pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 transition-colors uppercase ${barcodeError ? 'border-red-300 focus:ring-red-500' : isBarcodeValid && membershipBarcode.trim() ? 'border-green-300 focus:ring-green-500' : 'border-gray-300 focus:ring-blue-500'}`} maxLength={20} /><QrCodeIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /></div>{isCheckingBarcode && (<div className="flex items-center gap-1 text-xs text-gray-500 mt-1"><div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full" />Checking barcode availability...</div>)}{barcodeError && (<p className="text-xs text-red-600 mt-1">{barcodeError}</p>)}{isBarcodeValid && membershipBarcode.trim() && !isCheckingBarcode && !barcodeError && (<p className="text-xs text-green-600 mt-1 flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-500 rounded-full text-white text-center leading-3 text-[8px]">✓</span>Barcode is available</p>)}<p className="text-xs text-gray-500 mt-1">3-20 characters, letters and numbers only</p></div><div className="flex gap-2"><button onClick={handleGrantMembership} disabled={!membershipBarcode.trim() || !isBarcodeValid || isCheckingBarcode || !!barcodeError} className="px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isCheckingBarcode ? 'Validating...' : 'Grant Membership'}</button><button onClick={handleCancelBarcodeInput} className="px-3 py-1.5 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 transition-colors">Cancel</button></div></div> )}
            {customer.isMember && ( <div className="flex items-center justify-between"><div className="text-sm"><span className="font-medium text-yellow-800">Active Member</span>{customer.membershipBarcode && (<div className="text-xs text-yellow-700 mt-1">Barcode: <span className="font-mono">{customer.membershipBarcode}</span></div>)}</div><button onClick={() => onToggleMembership()} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600 transition-colors">Remove Membership</button></div> )}
        </div>

        {customer.dob && ( <div className="flex items-center gap-3"><GiftIcon className="w-5 h-5 text-pink-500" /><span className="font-medium text-gray-600">Birthday:</span><span>{new Date(customer.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span></div> )}
        {customer.survey && ( <div className="flex items-center gap-3"><TagIcon className="w-5 h-5 text-cyan-500" /><span className="font-medium text-gray-600">Source:</span><span>{customer.survey}</span></div> )}
        <div className="flex items-center gap-3"><CalendarDaysIcon className="w-5 h-5 text-gray-400" /><span className="font-medium text-gray-600">Last Visit:</span><span>{customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span></div>
        <div className="flex items-center gap-3 pt-3 border-t border-gray-200"><SparklesIcon className="w-5 h-5 text-indigo-500" /><span className="font-medium text-gray-600">Loyalty Points:</span><span className="font-bold text-lg text-indigo-600">{customer.loyaltyPoints ?? 0}</span></div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-3"><h4 className="text-base font-semibold text-gray-800">Recent Visits</h4><button onClick={onViewFullHistory} className="text-xs text-blue-600 hover:text-blue-800 transition-colors">View All ({customer.appointmentHistory.length})</button></div>
        <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2">
          {customer.appointmentHistory.length > 0 ? (customer.appointmentHistory.slice(0, 5).map((apt: AppointmentHistory) => (
            <div key={apt._id} className="p-3 bg-gray-100/70 rounded-lg text-sm hover:bg-gray-100 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{formatDateIST(apt.date)}</p>
                  <p className="text-xs text-gray-600">with {apt.stylistName}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">₹{apt.totalAmount.toFixed(2)}</p>
                  <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${getStatusColor(apt.status)}`}>{apt.status}</span>
                  {apt.isImported && <span className="block text-xs text-gray-400 italic mt-1">Imported</span>}
                </div>
              </div>
              <div className="flex items-start gap-2 mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                <TagIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{apt.services.join(', ') || 'Details unavailable'}</span>
              </div>
              {(apt.status === 'Paid' || apt.isImported) && (apt.invoiceNumber && apt.invoiceNumber !== 'N/A') && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TagIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Invoice: <span className="font-semibold text-gray-800">{apt.invoiceNumber}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BanknotesIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Paid via: <span className="font-semibold text-gray-800">{apt.paymentMode}</span></span>
                  </div>
                </div>
              )}
            </div>
          ))) : (
            <div className="text-center py-8">
              <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 italic">No past appointments found.</p>
              <p className="text-xs text-gray-400 mt-1">This will be their first visit!</p>
            </div>
          )}
        </div>
      </div>
      {customer.appointmentHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div><div className="text-lg font-bold text-blue-600">{customer.appointmentHistory.length}</div><div className="text-xs text-gray-500">Total Visits</div></div>
            <div><div className="text-lg font-bold text-green-600">₹{customer.appointmentHistory.filter(apt => apt.status === 'Paid').reduce((sum: number, apt: AppointmentHistory) => sum + apt.totalAmount, 0).toFixed(0)}</div><div className="text-xs text-gray-500">Total Spent</div></div>
          </div>
        </div>)}
    </div>
  );
};

export default CustomerDetailPanel;