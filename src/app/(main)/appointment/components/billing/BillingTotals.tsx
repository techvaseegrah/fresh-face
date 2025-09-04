import React from 'react';
import { BillingTotals as BillingTotalsType } from './billing.types';

// --- START ADDITION: Define type for the applied gift card prop ---
interface AppliedGiftCard {
  code: string;
  amountToApply: number;
}
// --- END ADDITION ---

interface BillingTotalsProps {
  totals: BillingTotalsType;
  isCorrectionMode: boolean;
  originalAmountPaid: number;
  // --- START ADDITION: Add new props for gift card display ---
  appliedGiftCard: AppliedGiftCard | null;
  onRemoveGiftCard: () => void;
  // --- END ADDITION ---
}

const BillingTotals: React.FC<BillingTotalsProps> = ({
  totals,
  isCorrectionMode,
  originalAmountPaid,
  // --- START ADDITION: Destructure new props ---
  appliedGiftCard,
  onRemoveGiftCard,
  // --- END ADDITION ---
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-8 items-end">
      <div className="space-y-1.5 text-sm order-2 md:order-1">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal:</span>
          <span>₹{totals.subtotalBeforeDiscount.toFixed(2)}</span>
        </div>
        {totals.membershipSavings > 0 && (
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Membership Savings:</span>
            <span>-₹{totals.membershipSavings.toFixed(2)}</span>
          </div>
        )}
        {totals.calculatedDiscount > 0 && (
          <div className="flex justify-between text-orange-600 font-semibold">
            <span>Manual Discount:</span>
            <span>-₹{totals.calculatedDiscount.toFixed(2)}</span>
          </div>
        )}
        
        {/* --- START ADDITION: Display for Applied Gift Card --- */}
        {appliedGiftCard && (
          <div className="flex justify-between text-indigo-600 font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Gift Card ({appliedGiftCard.code}):</span>
              <button
                type="button"
                onClick={onRemoveGiftCard}
                className="text-red-500 hover:text-red-700 text-xs font-normal"
                title="Remove Gift Card"
              >
                [x]
              </button>
            </div>
            <span>-₹{appliedGiftCard.amountToApply.toFixed(2)}</span>
          </div>
        )}
        {/* --- END ADDITION --- */}

        {isCorrectionMode && (
          <>
            <div className="flex justify-between text-gray-600 font-semibold border-t mt-2 pt-2">
              <span>New Bill Total:</span>
              <span>₹{totals.trueGrandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Previously Paid:</span>
              <span>-₹{originalAmountPaid.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
      <div className="text-right order-1 md:order-2">
        {totals.refundDue > 0 ? (
          <>
            <div className="text-sm text-gray-600 font-semibold text-blue-600">Refund Due</div>
            <div className="text-2xl md:text-3xl font-bold text-blue-600">₹{totals.refundDue.toFixed(2)}</div>
          </>
        ) : (
          <>
            <div className="text-sm text-gray-600 font-semibold">{isCorrectionMode ? 'Amount Due Now' : 'Grand Total'}</div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">₹{totals.displayTotal.toFixed(2)}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default BillingTotals;