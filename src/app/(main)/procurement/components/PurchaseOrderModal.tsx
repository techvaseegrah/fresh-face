'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { IPurchaseOrder, PurchaseOrderStatus, IProduct } from '@/types/procurement';
import { XMarkIcon, PlusIcon, TrashIcon, PhotoIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/useDebounce';
import ImageZoomModal from '@/components/ImageZoomModal';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { toast } from 'react-toastify';

// --- TYPE DEFINITIONS ---

interface ProductLineItem {
  id: number; // Must be a number
  product: IProduct | null;
  quantity: string;
  price: string;
  search: string;
  searchResults: IProduct[];
  isSearching: boolean;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: IPurchaseOrder | null;
  onSuccess: () => void;
  tenantFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

interface ProductSearchLineProps {
  line: ProductLineItem;
  onUpdate: (id: number, field: keyof ProductLineItem, value: any) => void;
  onRemove: (id: number) => void;
  isReadOnly: boolean;
  canRemove: boolean;
  tenantFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

// --- SUB-COMPONENTS ---

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
      <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" onClick={handleClick} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors p-2 rounded-md border cursor-pointer" title={isImage ? "Click to preview image" : "Click to open document"}>
        {isImage ? <PhotoIcon className="h-5 w-5 text-gray-600" /> : <DocumentTextIcon className="h-5 w-5 text-gray-600" />}
        <span className="text-sm text-indigo-600 font-medium break-all">{filename}</span>
      </a>
      {isZoomModalOpen && <ImageZoomModal src={invoiceUrl} onClose={() => setIsZoomModalOpen(false)} />}
    </>
  );
};

const ProductSearchLine = ({ line, onUpdate, onRemove, isReadOnly, canRemove, tenantFetch }: ProductSearchLineProps) => {
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
        const response = await tenantFetch(`/api/products/search?q=${debouncedSearch}`);
        if (response.ok) {
          const data: IProduct[] = await response.json();
          onUpdate(line.id, 'searchResults', data);
        } else {
          console.error("Failed to search for products:", await response.text());
          onUpdate(line.id, 'searchResults', []);
        }
      } catch (error) {
        console.error("Product search API call failed", error);
        onUpdate(line.id, 'searchResults', []);
      } finally {
        onUpdate(line.id, 'isSearching', false);
      }
    };
    searchProducts();
  }, [debouncedSearch, line.id, line.product?.name, tenantFetch, onUpdate]);

  const handleSelectProduct = (product: IProduct) => {
    setLocalSearch(product.name);
    onUpdate(line.id, 'product', product);
    onUpdate(line.id, 'search', product.name);
    onUpdate(line.id, 'price', String(product.price || ''));
    onUpdate(line.id, 'searchResults', []);
  };

  // --- NEW: Central handler for input changes with validation ---
  const handleInputChange = (field: 'search' | 'quantity' | 'price', value: string) => {
    let processedValue = value;

    if (field === 'search') {
      // Allow only letters and spaces for product search
      processedValue = value.replace(/[^a-zA-Z\s]/g, '');
      setLocalSearch(processedValue);
      onUpdate(line.id, 'search', processedValue);
      onUpdate(line.id, 'product', null);
    } else if (field === 'quantity') {
      // Allow only whole numbers for quantity
      processedValue = value.replace(/[^0-9]/g, '');
      onUpdate(line.id, 'quantity', processedValue);
    } else if (field === 'price') {
      // Allow numbers and a single decimal point for price
      processedValue = value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
      onUpdate(line.id, 'price', processedValue);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-3 items-start p-2 rounded-md bg-gray-50 border">
      <div className="col-span-5 relative">
        <label className="text-xs text-gray-500">Product Name</label>
        {/* --- MODIFIED: Use the new handler --- */}
        <input type="text" placeholder="Start typing to search..." value={localSearch} onChange={(e) => handleInputChange('search', e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:ring-1 focus:ring-indigo-500" disabled={isReadOnly} autoComplete="off" />
        {line.isSearching && <div className="absolute right-2 top-8 text-xs text-gray-500">Searching...</div>}
        {line.searchResults.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
            {line.searchResults.map((p) => (<li key={p._id.toString()} onClick={() => handleSelectProduct(p)} className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50">{p.name} <span className="text-xs text-gray-400">({p.sku})</span></li>))}
          </ul>
        )}
      </div>
      <div className="col-span-2">
        <label className="text-xs text-gray-500">Quantity</label>
        {/* --- MODIFIED: Use new handler and text type for better control --- */}
        <input type="text" inputMode="numeric" value={line.quantity} onChange={(e) => handleInputChange('quantity', e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm" disabled={isReadOnly} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-gray-500">Price</label>
        {/* --- MODIFIED: Use new handler and text type for better control --- */}
        <input type="text" inputMode="decimal" value={line.price} onChange={(e) => handleInputChange('price', e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm" disabled={isReadOnly} />
      </div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Total</label><p className="w-full px-3 py-2 rounded-md bg-gray-200 text-sm font-semibold h-10 flex items-center">₹{((parseFloat(line.quantity) || 0) * (parseFloat(line.price) || 0)).toFixed(2)}</p></div>
      <div className="col-span-1 flex items-center justify-center pt-6">{canRemove && <button onClick={() => onRemove(line.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon className="h-5 w-5" /></button>}</div>
    </div>
  );
};


// --- MAIN MODAL COMPONENT (No changes below this line) ---

export default function PurchaseOrderModal({ isOpen, onClose, po, onSuccess, tenantFetch }: ModalProps) {
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
    if (canReview && po.status === PurchaseOrderStatus.PENDING_ADMIN_REVIEW) return 'review';
    if (canApprove && po.status === PurchaseOrderStatus.PENDING_OWNER_APPROVAL) return 'approve';
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
          id: Date.now() + index,
          product: p.product as IProduct,
          search: (p.product as IProduct).name,
          quantity: String(isPastAdminReview ? p.approvedQuantity : p.requestedQuantity),
          price: String(isPastAdminReview ? p.approvedPrice : p.requestedPrice),
        }));
        setProducts(poProducts.length > 0 ? poProducts : [initialLine]);
        setExpectedDeliveryDate(new Date(po.expectedDeliveryDate).toISOString().split('T')[0]);
        if (mode === 'review') setRemarks(po.adminRemarks || '');
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

  const addProductLine = () => setProducts([...products, { id: Date.now(), product: null, quantity: '', price: '', search: '', searchResults: [], isSearching: false }]);
  const removeProductLine = (id: number) => setProducts(products.filter(p => p.id !== id));
  const handleProductChange = useCallback((id: number, field: keyof ProductLineItem, value: any) => setProducts(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p))), []);

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
          const originalProduct = po.products.find(op => (op.product as IProduct)._id.toString() === p.product?._id.toString());
          return {
            _id: originalProduct?._id, product: p.product?._id,
            approvedQuantity: parseFloat(p.quantity), approvedPrice: parseFloat(p.price),
            requestedQuantity: originalProduct?.requestedQuantity, requestedPrice: originalProduct?.requestedPrice, receivedQuantity: originalProduct?.receivedQuantity,
          };
        }),
        adminRemarks: mode === 'review' ? remarks : po.adminRemarks,
        ownerRemarks: mode === 'approve' ? remarks : po.ownerRemarks,
        remarks: remarks,
      };
      body = { action, payload };
    }

    try {
      const response = await tenantFetch(url, { method, body: JSON.stringify(body) });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Action failed: ${action}`);
      }
      toast.success(`Purchase order successfully ${action.toLowerCase().replace('_', ' ')}d!`);
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
  
  const getTitle = () => {
    switch (mode) {
      case 'create': return 'Create New Purchase Order';
      case 'review': return 'Review Purchase Order';
      case 'approve': return 'Approve Purchase Order';
      case 'view': return 'View Purchase Order Details';
      default: return 'Purchase Order';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{getTitle()}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-md font-semibold text-gray-700">Products</h3>
            {products.map((line) => (
              <ProductSearchLine key={line.id} line={line} onUpdate={handleProductChange} onRemove={removeProductLine} isReadOnly={mode === 'view'} canRemove={mode !== 'view' && products.length > 1} tenantFetch={tenantFetch} />
            ))}
            {mode !== 'view' && (
              <button onClick={addProductLine} className="flex items-center gap-2 text-sm text-indigo-600 font-semibold hover:bg-indigo-50 p-2 rounded-md transition-colors">
                <PlusIcon className="h-4 w-4" /> Add Product
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700">Expected Delivery Date</label>
              <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-gray-300 text-sm focus:ring-1 focus:ring-indigo-500" disabled={mode === 'view'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{mode === 'create' ? 'Manager Remarks' : 'Remarks'}</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 rounded-md border border-gray-300 text-sm focus:ring-1 focus:ring-indigo-500" disabled={mode === 'view'} placeholder="Add any notes..." />
            </div>
            {po?.invoiceUrl && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Uploaded Invoice</label>
                <InvoiceDisplay invoiceUrl={po.invoiceUrl} />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">{error}</p>}
        </div>
        {mode !== 'view' && (
          <div className="p-4 flex justify-between items-center border-t bg-gray-50">
            <div>
              {mode === 'approve' && (
                <button type="button" onClick={() => handleSubmit('CANCEL')} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-red-700 disabled:bg-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors">
                  Cancel Order
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                Close
              </button>
              <button type="button" onClick={() => { if (mode === 'create') handleSubmit('CREATE'); if (mode === 'review') handleSubmit('SUBMIT_FOR_APPROVAL'); if (mode === 'approve') handleSubmit('APPROVE'); }} disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                {isSubmitting ? 'Submitting...' : mode === 'create' ? 'Submit for Review' : mode === 'review' ? 'Submit to Owner' : mode === 'approve' ? 'Approve Order' : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}