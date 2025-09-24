'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import Receipt from './Receipt'; // Make sure this path is correct
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';

// Assuming these types are correctly defined in your Receipt component file or a central types file
import { FinalizedInvoice, BusinessDetails } from './Receipt'; 

interface PrintModalProps {
  invoiceData: FinalizedInvoice | null;
  businessDetails: BusinessDetails | null;
  onClose: () => void;
}

const PrintModal: React.FC<PrintModalProps> = ({ invoiceData, businessDetails, onClose }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  // ✅ THE FIX: We define handlePrint as a function to be called on click.
  // We REMOVE the complex 'trigger' prop.
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `Invoice-${invoiceData?.invoiceNumber || 'receipt'}`,
    onAfterPrint: () => toast.success('Print command sent!'),
  });

  if (!invoiceData || !businessDetails) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-start z-50 p-4 overflow-y-auto">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg mt-8 mb-8">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Print Invoice</h2>
          <div className="flex items-center gap-2">
            
            {/* ✅ THE FIX: We render a normal button and call handlePrint onClick. */}
            {/* This will bring the button back and make it work. */}
            <button
              onClick={handlePrint} 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PrinterIcon className="w-5 h-5" />
              <span>Print</span>
            </button>
            
            <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* The hidden print source. The ref is attached here. */}
        <div style={{ display: 'none' }}>
          <Receipt ref={componentRef} invoiceData={invoiceData} businessDetails={businessDetails} />
        </div>

        {/* The visible preview. No ref is attached here. */}
        <div className="w-full bg-gray-100 p-4 border border-gray-300 rounded-md">
             <div className="mx-auto" style={{ width: '288px' }}>
                <Receipt invoiceData={invoiceData} businessDetails={businessDetails} />
             </div>
        </div>

      </div>
    </div>
  );
};

export default PrintModal;