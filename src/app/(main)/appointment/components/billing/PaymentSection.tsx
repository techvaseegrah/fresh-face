import React from 'react';
import { BillingTotals } from './billing.types';

type PaymentDetails = { cash: number; card: number; upi: number; other: number; };

interface PaymentSectionProps {
  newPaymentDetails: PaymentDetails;
  onPaymentChange: (method: keyof PaymentDetails, amount: string) => void;
  totals: BillingTotals;
  isCorrectionMode: boolean;
  // --- START ADDITION: Add props for gift card functionality ---
  onApplyGiftCardClick: () => void;
  isGiftCardApplied: boolean;
  // --- END ADDITION ---
}

const PaymentSection: React.FC<PaymentSectionProps> = ({
  newPaymentDetails,
  onPaymentChange,
  totals,
  isCorrectionMode,
  // --- START ADDITION: Destructure new props ---
  onApplyGiftCardClick,
  isGiftCardApplied,
  // --- END ADDITION ---
}) => {
  return (
    <div className="pt-4 border-t">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Enter New Payment</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4 sm:col-span-2">
          {(['cash', 'card', 'upi', 'other'] as const).map(method => (
            <div key={method}>
              <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{method}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newPaymentDetails[method] || ''}
                onChange={e => onPaymentChange(method, e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder="0.00"
              />
            </div>
          ))}
        </div>

        {/* --- START ADDITION: Action buttons section --- */}
        <div className="flex flex-wrap gap-2 items-center sm:col-span-2 mt-2">
           {/* You can add your "Apply Discount" button here in the future if needed */}
           {/* <button className="px-3 py-2 border rounded-md text-xs font-medium hover:bg-gray-50">
              Apply Discount
           </button> */}
           
           <button
              type="button"
              onClick={onApplyGiftCardClick}
              disabled={isGiftCardApplied}
              className="px-3 py-2 border rounded-md text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
              {isGiftCardApplied ? 'Gift Card Applied' : 'Apply Gift Card'}
            </button>
        </div>
        {/* --- END ADDITION --- */}

        <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm sm:col-span-2">
          <div className="flex justify-between">
            <span>Total New Payment:</span>
            <span className="font-semibold">₹{totals.totalNewPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>{isCorrectionMode ? 'Amount Due:' : 'Bill Total:'}</span>
            <span className="font-semibold">₹{totals.displayTotal.toFixed(2)}</span>
          </div>
          {totals.changeDue > 0 ? (
            <div className="flex justify-between mt-1 text-blue-600 font-bold">
              <span>Change Due:</span>
              <span>₹{totals.changeDue.toFixed(2)}</span>
            </div>
          ) : (
            <div className={`flex justify-between mt-1 ${Math.abs(totals.balance) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
              <span>Remaining Balance:</span>
              <span className="font-bold">₹{totals.balance.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSection;