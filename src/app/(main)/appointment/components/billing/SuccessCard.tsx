// appointment/components/billing/SuccessCard.tsx

import React from 'react';
import { CheckCircleIcon, PrinterIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { FinalizedInvoice } from './billing.types';

interface SuccessCardProps {
  finalizedInvoiceData: FinalizedInvoice | null;
  onClose: () => void;
  onPrintReceipt: () => void;
  isLoadingBusinessDetails: boolean;
}

const SuccessCard: React.FC<SuccessCardProps> = ({ finalizedInvoiceData, onClose, onPrintReceipt, isLoadingBusinessDetails }) => {
  return (
    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center transform transition-all">
      <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h2>
      <p className="text-gray-600 mb-8">
        Invoice <span className="font-semibold text-gray-900">{finalizedInvoiceData?.invoiceNumber}</span> for <span className="font-semibold text-gray-900">₹{finalizedInvoiceData?.grandTotal.toFixed(2)}</span> has been recorded.
      </p>
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={onClose}
          className="px-6 py-2 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 flex items-center gap-2 font-semibold"
        >
          <XCircleIcon className="w-5 h-5" />
          Finish
        </button>
        <button
          onClick={onPrintReceipt}
          disabled={!finalizedInvoiceData || isLoadingBusinessDetails}
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 font-semibold disabled:opacity-50"
        >
          <PrinterIcon className="w-5 h-5" />
          {isLoadingBusinessDetails ? 'Loading...' : 'Print Receipt'}
        </button>
      </div>
    </div>
  );
};

export default SuccessCard;