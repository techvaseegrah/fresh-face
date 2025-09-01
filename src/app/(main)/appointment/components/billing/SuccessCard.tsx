'use client';

import React from 'react';
import { FinalizedInvoice } from './billing.types';
import  Button  from '@/components/ui/Button'; // Adjust this import if needed

interface SuccessCardProps {
  finalizedInvoiceData: FinalizedInvoice | null;
  onClose: () => void;
  onPrintReceipt: () => void;
  isLoadingBusinessDetails: boolean;
}

const SuccessCard: React.FC<SuccessCardProps> = ({ finalizedInvoiceData, onClose, onPrintReceipt, isLoadingBusinessDetails }) => {
  if (!finalizedInvoiceData) {
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-gray-800">Processing...</h3>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-lg text-center">
      {/* --- Main Success Message --- */}
      <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 className="mt-4 text-2xl font-semibold text-gray-900">Payment Successful</h3>
      <p className="mt-2 text-sm text-gray-600">
        Invoice #{finalizedInvoiceData.invoiceNumber} has been finalized for a total of <span className="font-bold">₹{finalizedInvoiceData.grandTotal.toFixed(2)}</span>.
      </p>

      {/* --- START: NEW SECTION TO DISPLAY ISSUED GIFT CARD CODES --- */}
      {finalizedInvoiceData.issuedGiftCards && finalizedInvoiceData.issuedGiftCards.length > 0 && (
        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-left">
          <h4 className="font-bold text-indigo-800 text-base mb-2">Gift Card(s) Issued</h4>
          <p className="text-sm text-indigo-700 mb-3">
            Please provide the following unique code(s) to the customer. They will need this for redemption.
          </p>
          <div className="space-y-3">
            {finalizedInvoiceData.issuedGiftCards.map(card => (
              <div key={card._id} className="bg-white p-3 border rounded-md font-mono text-center shadow-sm">
                <span className="block text-gray-500 text-xs">UNIQUE CODE</span>
                <span className="text-xl font-bold tracking-widest text-indigo-900">{card.uniqueCode}</span>
                <span className="block text-gray-600 text-sm mt-1">(Value: ₹{card.initialBalance})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* --- END: NEW SECTION --- */}

      {/* --- Action Buttons --- */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button 
          onClick={onPrintReceipt} 
          disabled={isLoadingBusinessDetails} 
          variant="outline"
        >
          {isLoadingBusinessDetails ? 'Loading...' : 'Print Receipt'}
        </Button>
        <Button onClick={onClose}>
          Close & New Bill
        </Button>
      </div>
    </div>
  );
};

export default SuccessCard;