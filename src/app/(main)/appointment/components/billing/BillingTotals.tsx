// appointment/components/billing/BillingTotals.tsx

import React from 'react';
import { BillingTotals as BillingTotalsType } from './billing.types';

interface BillingTotalsProps {
  totals: BillingTotalsType;
  isCorrectionMode: boolean;
  originalAmountPaid: number;
}

const BillingTotals: React.FC<BillingTotalsProps> = ({ totals, isCorrectionMode, originalAmountPaid }) => {
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