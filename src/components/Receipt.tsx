'use client';

import React from 'react';

// =================================================================
// TYPE DEFINITIONS (This is the missing part)
// =================================================================

// Defines the structure for a single item in the invoice
interface LineItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  finalPrice: number;
  // Add other properties if needed by your logic
}

// Defines the main invoice data structure
interface FinalizedInvoice {
  invoiceNumber: string;
  createdAt: string; // ISO string format
  customer: { name: string };
  billingStaff: { name: string };
  lineItems: LineItem[];
  membershipDiscount: number;
  finalManualDiscountApplied?: number;
  grandTotal: number;
  paymentDetails: {
    [key: string]: number | string; // Allows for methods like cash, card, etc.
  };
  giftCardPayment?: {
    amount: number;
  };
}

// Defines the business details
interface BusinessDetails {
  name: string;
  address: string;
  phone: string;
  gstin?: string;
}

// Defines the props for the Receipt component itself
interface ReceiptProps {
  invoiceData: FinalizedInvoice | null;
  businessDetails: BusinessDetails | null;
}

// =================================================================
// COMPONENT
// =================================================================

const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(({ invoiceData, businessDetails }, ref) => {
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

  // Calculate subtotal based on original unit price for clear accounting
  const subtotal = invoiceData.lineItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const membershipSavings = invoiceData.membershipDiscount || 0;
  const manualDiscount = invoiceData.finalManualDiscountApplied || 0;

  return (
    <div ref={ref} className="bg-white text-black font-mono text-xs p-2" style={{ width: '288px' }}>
      <header className="text-center mb-4">
        <h1 className="text-lg font-bold uppercase">{businessDetails.name}</h1>
        <p>{businessDetails.address}</p>
        <p>Ph: {businessDetails.phone}</p>
        {businessDetails.gstin && <p>GSTIN: {businessDetails.gstin}</p>}
      </header>
      
      <section className="border-t border-b border-dashed border-black py-2 mb-2">
        <div className="flex justify-between"><span>Invoice No:</span><span>{invoiceData.invoiceNumber}</span></div>
        <div className="flex justify-between"><span>Date:</span><span>{formatDateTime(invoiceData.createdAt)}</span></div>
        <div className="flex justify-between"><span>Customer:</span><span>{invoiceData.customer.name}</span></div>
        <div className="flex justify-between"><span>Billed By:</span><span>{invoiceData.billingStaff.name}</span></div>
      </section>

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
              {/* Display original total price for transparency */}
              <div className="w-16 text-right">₹{(item.unitPrice * item.quantity).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </main>

      <section className="border-t border-dashed border-black pt-2 space-y-1">
        <div className="flex justify-between"><span>Subtotal:</span><span>₹{subtotal.toFixed(2)}</span></div>
        {membershipSavings > 0 && (<div className="flex justify-between"><span>Member Savings:</span><span>-₹{membershipSavings.toFixed(2)}</span></div>)}
        {manualDiscount > 0 && (<div className="flex justify-between"><span>Discount:</span><span>-₹{manualDiscount.toFixed(2)}</span></div>)}
        <div className="flex justify-between font-bold text-sm border-t border-black mt-1 pt-1"><span>GRAND TOTAL:</span><span>₹{invoiceData.grandTotal.toFixed(2)}</span></div>
      </section>

      <section className="border-t border-dashed border-black mt-2 pt-2 space-y-1">
        <h2 className="font-bold text-center mb-1">Payment Details</h2>
        
        {invoiceData.giftCardPayment && invoiceData.giftCardPayment.amount > 0 && (
          <div className="flex justify-between">
            <span>Gift Card:</span>
            <span>₹{invoiceData.giftCardPayment.amount.toFixed(2)}</span>
          </div>
        )}
        
        {Object.entries(invoiceData.paymentDetails).map(([method, amount]) =>
          Number(amount) > 0 ? (
            <div key={method} className="flex justify-between capitalize">
              <span>{method}:</span>
              <span>₹{Number(amount).toFixed(2)}</span>
            </div>
          ) : null
        )}
      </section>

      <footer className="text-center mt-4 pt-2 border-t border-black">
        <p>Thank you for your visit!</p>
        <p>See you again soon.</p>
      </footer>
    </div>
  );
});

Receipt.displayName = 'Receipt';
export default Receipt;