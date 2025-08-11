'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { IPurchaseOrder, PurchaseOrderStatus, IProduct } from '@/types/procurement';
import { XMarkIcon, PlusIcon, TrashIcon, PhotoIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/useDebounce';
import ImageZoomModal from '@/components/ImageZoomModal';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

interface ProductLineItem { id: number; product: IProduct | null; quantity: string; price: string; search: string; searchResults: IProduct[]; isSearching: boolean; }
interface ModalProps { isOpen: boolean; onClose: () => void; po: IPurchaseOrder | null; onSuccess: () => void; }
interface ProductSearchLineProps { line: ProductLineItem; onUpdate: (id: number, field: keyof ProductLineItem, value: any) => void; onRemove: (id: number) => void; isReadOnly: boolean; canRemove: boolean; }

const InvoiceDisplay = ({ invoiceUrl }: { invoiceUrl: string }) => {
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  
  const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => invoiceUrl.toLowerCase().endsWith(ext));
  const filename = invoiceUrl.split('/').pop();

  const handleClick = (e: React.MouseEvent) => {
    if (isImage) {
      e.preventDefault();
      setIsZoomModalOpen(true);
    }
  };

  return (
    <>
      <a
        href={invoiceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors p-2 rounded-md border cursor-pointer"
        title={isImage ? "Click to preview image" : "Click to open document"}
      >
        {isImage ? <PhotoIcon className="h-5 w-5 text-gray-600" /> : <DocumentTextIcon className="h-5 w-5 text-gray-600" />}
        <span className="text-sm text-indigo-600 font-medium break-all">{filename}</span>
      </a>

      {isZoomModalOpen && (
        <ImageZoomModal 
          src={invoiceUrl}
          onClose={() => setIsZoomModalOpen(false)}
        />
      )}
    </>
  );
};


const ProductSearchLine = ({ line, onUpdate, onRemove, isReadOnly, canRemove }: ProductSearchLineProps) => {
  const [localSearch, setLocalSearch] = useState(line.search);
  const debouncedSearch = useDebounce(localSearch, 500);

  useEffect(() => {
    setLocalSearch(line.search);
  }, [line.search]);

  useEffect(() => {
    const searchProducts = async () => {
      if (debouncedSearch.trim() === '' || line.product?.name === debouncedSearch) {
        onUpdate(line.id, 'searchResults', []);
        onUpdate(line.id, 'isSearching', false);
        return;
      }
      onUpdate(line.id, 'isSearching', true);
      try {
        const response = await fetch(`/api/products/search?q=${debouncedSearch}`);
        const data: IProduct[] = await response.json();
        onUpdate(line.id, 'searchResults', data);
      } catch (error) {
        console.error("Failed to search for products", error);
        onUpdate(line.id, 'searchResults', []);
      } finally {
        onUpdate(line.id, 'isSearching', false);
      }
    };
    searchProducts();
  }, [debouncedSearch, line.id, line.product?.name]);

  const handleSelectProduct = (product: IProduct) => {
    setLocalSearch(product.name);
    onUpdate(line.id, 'product', product);
    onUpdate(line.id, 'search', product.name);
    onUpdate(line.id, 'price', String(product.price || ''));
    onUpdate(line.id, 'searchResults', []);
  };

  return (
    <div className="grid grid-cols-12 gap-3 items-start p-2 rounded-md bg-gray-50 border">
      <div className="col-span-5 relative">
        <label className="text-xs text-gray-500">Product Name</label>
        <input
          type="text"
          placeholder="Start typing to search..."
          value={localSearch}
          onChange={(e) => {
            setLocalSearch(e.target.value);
            onUpdate(line.id, 'search', e.target.value);
            onUpdate(line.id, 'product', null);
          }}
          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:ring-1 focus:ring-indigo-500"
          disabled={isReadOnly}
          autoComplete="off"
        />
        {line.isSearching && <div className="absolute right-2 top-8 text-xs text-gray-500">Searching...</div>}
        {line.searchResults.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
            {line.searchResults.map((p) => (
              <li key={p._id} onClick={() => handleSelectProduct(p)} className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50">
                {p.name} <span className="text-xs text-gray-400">({p.sku})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="col-span-2">
        <label className="text-xs text-gray-500">Quantity</label>
        <input type="number" value={line.quantity} onChange={(e) => onUpdate(line.id, 'quantity', e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm" disabled={isReadOnly} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-gray-500">Price</label>
        <input type="number" value={line.price} onChange={(e) => onUpdate(line.id, 'price', e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm" disabled={isReadOnly} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-gray-500">Total</label>
        <p className="w-full px-3 py-2 rounded-md bg-gray-200 text-sm font-semibold h-10 flex items-center">
          ₹{((parseFloat(line.quantity) || 0) * (parseFloat(line.price) || 0)).toFixed(2)}
        </p>
      </div>
      <div className="col-span-1 flex items-center justify-center pt-6">
        {canRemove && <button onClick={() => onRemove(line.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon className="h-5 w-5" /></button>}
      </div>
    </div>
  );
};

export default function PurchaseOrderModal({ isOpen, onClose, po, onSuccess }: ModalProps) {
  const { data: session } = useSession();
  const userPermissions = session?.user?.role?.permissions || [];

  const canReview = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_REVIEW);
  const canApprove = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_APPROVE);

  const [products, setProducts] = useState<ProductLineItem[]>([]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMode = (): 'create' | 'review' | 'approve' | 'view' => {
    if (!po) return 'create';
    // The mode is now determined by permissions AND status
    if (canReview && po.status === PurchaseOrderStatus.PENDING_ADMIN_REVIEW) return 'review';
    if (canApprove && po.status === PurchaseOrderStatus.PENDING_OWNER_APPROVAL) return 'approve';
    // For all other cases, it's just a read-only view
    return 'view';
  };

  const mode = getMode();

  useEffect(() => {
    if (isOpen) {
      const initialLine = { id: Date.now(), product: null, quantity: '', price: '', search: '', searchResults: [], isSearching: false };
      if (po) {
        const isPastAdminReview = ![PurchaseOrderStatus.PENDING_ADMIN_REVIEW].includes(po.status);
        const poProducts = po.products.map((p, index) => ({
          ...initialLine,
          id: index,
          product: p.product,
          search: p.product.name,
          // If past admin review, show approved values, otherwise show requested values
          quantity: String(isPastAdminReview ? p.approvedQuantity : p.requestedQuantity),
          price: String(isPastAdminReview ? p.approvedPrice : p.requestedPrice),
        }));

        setProducts(poProducts.length > 0 ? poProducts : [initialLine]);
        setExpectedDeliveryDate(new Date(po.expectedDeliveryDate).toISOString().split('T')[0]);
        if(mode === 'review') setRemarks(po.adminRemarks || '');
        else if (mode === 'approve') setRemarks(po.ownerRemarks || '');
        else setRemarks(po.managerRemarks || '');
      } else {
        setProducts([initialLine]);
        setExpectedDeliveryDate(new Date().toISOString().split('T')[0]);
        setRemarks('');
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, po, mode]);

  const addProductLine = () => {
    setProducts([...products, { id: Date.now(), product: null, quantity: '', price: '', search: '', searchResults: [], isSearching: false }]);
  };

  const removeProductLine = (id: number) => {
    setProducts(products.filter(p => p.id !== id));
  };
  
  const handleProductChange = useCallback((id: number, field: keyof ProductLineItem, value: any) => {
    setProducts(prevProducts =>
      prevProducts.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  }, []);

  const handleSubmit = async (action: 'CREATE' | 'SUBMIT_FOR_APPROVAL' | 'APPROVE' | 'CANCEL') => {
    setIsSubmitting(true);
    setError(null);
  
    if (action !== 'CANCEL' && products.filter(p => p.product?._id && parseFloat(p.quantity) > 0).length === 0) {
        setError("Please add at least one valid product with a quantity.");
        setIsSubmitting(false);
        return;
    }
  
    let url = '/api/procurement/purchase-orders';
    let method = 'POST';
    let body: any = {};
  
    if (action === 'CREATE') {
      body = {
        products: products.map(p => ({ productId: p.product!._id, quantity: parseFloat(p.quantity), price: parseFloat(p.price) })),
        expectedDeliveryDate, managerRemarks: remarks,
      };
    } else if (po) {
      url = `/api/procurement/purchase-orders/${po._id}`;
      method = 'PUT';
  
      const payload = {
        products: products.map(p => {
          const originalProduct = po.products.find(op => op.product._id === p.product?._id);
          return {
            _id: originalProduct?._id, product: p.product?._id,
            // When reviewing or approving, the new values are for the approved fields
            approvedQuantity: parseFloat(p.quantity), 
            approvedPrice: parseFloat(p.price),
            // We must preserve these original values from the PO object
            requestedQuantity: originalProduct?.requestedQuantity, 
            requestedPrice: originalProduct?.requestedPrice,
            receivedQuantity: originalProduct?.receivedQuantity,
          };
        }),
        adminRemarks: mode === 'review' ? remarks : po.adminRemarks,
        ownerRemarks: mode === 'approve' ? remarks : po.ownerRemarks,
        remarks: remarks, // Generic remarks for cancellation
      };
      body = { action, payload };
    }
  
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Action failed: ${action}`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getTitle = () => {
    switch (mode) {
      case 'create': return 'Create New Purchase Order';
      case 'review': return 'Review Purchase Order';
      case 'approve': return 'Approve Purchase Order';
      case 'view': return 'View Purchase Order Details';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-semibold">{getTitle()}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><XMarkIcon className="h-6 w-6" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-md font-semibold">Products</h3>
            {products.map((line) => (
              <ProductSearchLine
                key={line.id}
                line={line}
                onUpdate={handleProductChange}
                onRemove={removeProductLine}
                isReadOnly={mode === 'view'}
                canRemove={mode !== 'view' && products.length > 1}
              />
            ))}
            {mode !== 'view' && (
              <button onClick={addProductLine} className="flex items-center gap-2 text-sm text-indigo-600 font-semibold hover:bg-indigo-50 p-2 rounded-md">
                <PlusIcon className="h-4 w-4" /> Add Product
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium">Expected Delivery Date</label>
              <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm" disabled={mode === 'view'}/>
            </div>
            <div>
              <label className="block text-sm font-medium">{mode === 'create' ? 'Manager Remarks' : 'Remarks'}</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm" disabled={mode === 'view'} placeholder="Add any notes..."/>
            </div>

             {/* --- ADD THIS NEW BLOCK --- */}
          {po?.invoiceUrl && (
          <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Uploaded Invoice</label>
          <InvoiceDisplay invoiceUrl={po.invoiceUrl} />
          </div>
          )}

          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
        </div>

  {mode !== 'view' && (
  <div className="p-4 flex justify-between items-center border-t bg-gray-50">
    <div>
      {/* Show Cancel button only for Owner/SuperAdmin in approve mode */}
      {mode === 'approve' && (
        <button
          type="button"
          onClick={() => handleSubmit('CANCEL')}
          disabled={isSubmitting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-red-400"
        >
          Cancel Order
        </button>
      )}
    </div>
    <div className="flex gap-3">
      <button type="button" onClick={onClose} className="px-4 py-2 bg-white border rounded-lg text-sm font-medium hover:bg-gray-50">
        Close
      </button>
      <button
        type="button"
        onClick={() => {
          if (mode === 'create') handleSubmit('CREATE');
          if (mode === 'review') handleSubmit('SUBMIT_FOR_APPROVAL');
          if (mode === 'approve') handleSubmit('APPROVE');
        }}
        disabled={isSubmitting}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-indigo-400"
      >
        {isSubmitting ? 'Submitting...' :
          mode === 'create' ? 'Submit for Review' :
          mode === 'review' ? 'Submit to Owner' :
          mode === 'approve' ? 'Approve Order' : 'Submit'}
      </button>
    </div>
  </div>
)}
      </div>
    </div>
  );
}