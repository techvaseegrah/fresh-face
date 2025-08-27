'use client';

import { useState, useEffect, useRef } from 'react';
import { IPurchaseOrder } from '@/types/procurement';
import { XMarkIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { getSession } from 'next-auth/react'; // Import getSession for this specific use case
import { toast } from 'react-toastify';

// 1. UPDATE MODALPROPS
// Although we won't use tenantFetch for the FormData POST, we keep the signature
// consistent with other modals for simplicity in the parent component.
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: IPurchaseOrder;
  onSuccess: () => void;
  tenantFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

interface ReceivedProduct {
  productId: string;
  quantity: number;
}

export default function ReceiveStockModal({ isOpen, onClose, po, onSuccess }: ModalProps) {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, string>>({});
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const initialQuantities: Record<string, string> = {};
      // Ensure p.product exists and has an _id before using it as a key
      po.products.forEach(p => {
        if (p.product && p.product._id) {
            const remaining = p.approvedQuantity - p.receivedQuantity;
            initialQuantities[p.product._id.toString()] = String(remaining > 0 ? remaining : 0);
        }
      });
      setReceivedQuantities(initialQuantities);
      setInvoiceFile(null);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, po]);

  const handleQuantityChange = (productId: string, value: string) => {
    setReceivedQuantities(prev => ({ ...prev, [productId]: value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInvoiceFile(e.target.files[0]);
    }
  };

  // 2. UPDATE handleSubmit TO BE TENANT-AWARE FOR FormData
  const handleSubmit = async () => {
    if (!invoiceFile) {
      setError("An invoice file is mandatory.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    const productsToReceive: ReceivedProduct[] = Object.entries(receivedQuantities)
      .map(([productId, quantity]) => ({
        productId,
        quantity: parseInt(quantity, 10) || 0,
      }))
      .filter(p => p.quantity > 0);

    if (productsToReceive.length === 0) {
      setError("Please enter a quantity for at least one product.");
      setIsSubmitting(false);
      return;
    }

    // This part is crucial for tenant-aware file uploads.
    // We get the session directly to add the tenant ID header manually.
    const session = await getSession();
    if (!session?.user?.tenantId) {
        setError("Session error: Tenant not found. Please log in again.");
        setIsSubmitting(false);
        return;
    }
    
    const formData = new FormData();
    formData.append('invoice', invoiceFile);
    formData.append('products', JSON.stringify(productsToReceive));

    // Create headers and add ONLY the tenant-id.
    // DO NOT set 'Content-Type'. The browser sets it to 'multipart/form-data'
    // with the correct boundary when the body is a FormData object.
    const headers = new Headers();
    headers.append('x-tenant-id', session.user.tenantId);

    try {
      const response = await fetch(`/api/procurement/purchase-orders/${po._id}/receive`, {
        method: 'POST',
        headers: headers, // Use our custom headers
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to receive stock.');
      }
      
      toast.success("Stock received and inventory updated successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Receive Stock for {po.poId}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-4 text-xs font-semibold text-gray-500 px-2">
              <div className="col-span-2">Product Name</div>
              <div className="text-center">Approved</div>
              <div className="text-center">Received</div>
              <div className="text-center">Receiving Now</div>
            </div>
            {po.products.map(p => {
              const productId = (p.product as any)._id.toString();
              const remaining = p.approvedQuantity - p.receivedQuantity;
              return (
                <div key={productId} className="grid grid-cols-5 gap-4 items-center p-2 rounded-md bg-gray-50 border">
                  <div className="col-span-2 font-medium text-sm text-gray-800">{(p.product as any).name}</div>
                  <div className="text-sm text-center text-gray-700">{p.approvedQuantity}</div>
                  <div className="text-sm text-gray-500 text-center">{p.receivedQuantity}</div>
                  <div className="text-center">
                    <input
                      type="number"
                      value={receivedQuantities[productId] || ''}
                      onChange={(e) => handleQuantityChange(productId, e.target.value)}
                      className="w-20 px-2 py-1 rounded-md border border-gray-300 text-sm text-center focus:ring-1 focus:ring-indigo-500"
                      max={remaining}
                      min="0"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Invoice (Mandatory)</label>
            <div 
              className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer transition-colors hover:bg-gray-50"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="space-y-1 text-center">
                <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <p className="pl-1">{invoiceFile ? <span className="font-semibold text-indigo-600">{invoiceFile.name}</span> : "Click to select a file"}</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".png,.jpg,.jpeg,.pdf"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">{error}</p>}
        </div>

        <div className="p-4 flex justify-end gap-3 border-t bg-gray-50">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
            {isSubmitting ? 'Submitting...' : 'Confirm and Receive Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}