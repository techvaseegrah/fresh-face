'use client';

import React from 'react';
// Make sure this import path correctly points to your billingmodal.tsx file
import { FinalizedInvoice } from '@/app/(main)/appointment/billingmodal'; 

interface BusinessDetails {
  name: string;
  address: string;
  phone: string;
  gstin?: string; // Optional tax ID
}

// This interface ensures the receipt gets the `membershipDiscount` from the API response
interface FinalizedInvoiceForReceipt extends FinalizedInvoice {
    membershipDiscount: number;
}

interface ReceiptProps {
  invoiceData: FinalizedInvoiceForReceipt | null;
  businessDetails: BusinessDetails | null;
}

const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(({ invoiceData, businessDetails }, ref) => {
  // This guard clause is crucial. It waits until both the invoice and business details are loaded.
  if (!invoiceData || !businessDetails) {
    return null;
  }

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Using the accurate, final values passed from the backend API
  const subtotal = invoiceData.lineItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const membershipSavings = invoiceData.membershipDiscount || 0;
  const manualDiscount = invoiceData.finalManualDiscountApplied || 0;


  return (
    <div ref={ref} className="bg-white text-black font-mono text-xs p-2" style={{ width: '288px' }}>
      {/* =================================================================== */}
      {/* ✅ HEADER: This section now displays the dynamic data from your Tenant API */}
      {/* =================================================================== */}
      <header className="text-center mb-4">
        <h1 className="text-lg font-bold uppercase">{businessDetails.name}</h1>
        <p>{businessDetails.address}</p>
        <p>Ph: {businessDetails.phone}</p>
        {businessDetails.gstin && <p>GSTIN: {businessDetails.gstin}</p>}
      </header>
      {/* =================================================================== */}
      
      {/* Invoice Info */}
      <section className="border-t border-b border-dashed border-black py-2 mb-2">
        <div className="flex justify-between">
          <span>Invoice No:</span>
          <span>{invoiceData.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDateTime(invoiceData.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer:</span>
          <span>{invoiceData.customer.name}</span>
        </div>
        <div className="flex justify-between">
          <span>Billed By:</span>
          <span>{invoiceData.billingStaff.name}</span>
        </div>
      </section>

      {/* Line Items Table */}
      <main className="mb-2">
        <div className="flex font-bold border-b border-black pb-1">
          <div className="flex-grow">Item</div>
          <div className="w-6 text-center">Qty</div>
          <div className="w-16 text-right">Total</div>
        </div>
        <div className="py-1 space-y-1">
          {invoiceData.lineItems.map((item, index) => (
            <div key={`${item.itemId}-${index}`} className="flex">
              <div className="flex-grow pr-1">{item.name}</div>
              <div className="w-6 text-center">{item.quantity}</div>
              <div className="w-16 text-right">₹{item.finalPrice.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Totals Section */}
      <section className="border-t border-dashed border-black pt-2 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        
        {membershipSavings > 0 && (
          <div className="flex justify-between">
            <span>Member Savings:</span>
            <span>-₹{membershipSavings.toFixed(2)}</span>
          </div>
        )}
        {manualDiscount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-₹{manualDiscount.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-sm border-t border-black mt-1 pt-1">
          <span>GRAND TOTAL:</span>
          <span>₹{invoiceData.grandTotal.toFixed(2)}</span>
        </div>
      </section>

      {/* Payment Details */}
      <section className="border-t border-dashed border-black mt-2 pt-2 space-y-1">
        <h2 className="font-bold text-center mb-1">Payment Details</h2>
        {Object.entries(invoiceData.paymentDetails).map(([method, amount]) =>
          Number(amount) > 0 ? (
            <div key={method} className="flex justify-between capitalize">
              <span>{method}:</span>
              <span>₹{Number(amount).toFixed(2)}</span>
            </div>
          ) : null
        )}
      </section>

      {/* Footer */}
      <footer className="text-center mt-4 pt-2 border-t border-black">
        <p>Thank you for your visit!</p>
        <p>See you again soon.</p>
      </footer>
    </div>
  );
});

Receipt.displayName = 'Receipt';
export default Receipt;