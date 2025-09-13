'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';
import { Toaster, toast } from 'react-hot-toast';
import { Package, Warehouse, History, X, Search, AlertTriangle, Building, Tag, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Interface Definitions ---
interface PopulatedRef { _id: string; name: string; }
interface Product { _id: string; sku: string; name: string; brand: PopulatedRef; subCategory: PopulatedRef; type: 'Retail' | 'In-House'; totalQuantity: number; numberOfItems: number; quantityPerItem: number; unit: 'ml' | 'g' | 'kg' | 'l' | 'piece'; }
interface InventoryCheck { _id: string; product: Product; date: string; expectedQuantity: number; actualQuantity: number; discrepancy: number; notes?: string; checkedBy: { name:string }; }
interface Pagination { currentPage: number; totalPages: number; totalItems: number; limit: number; }

// --- Helper & Pagination Components (Unchanged) ---
const StockDisplay = ({ product }: { product: Product }) => {
  const { numberOfItems, quantityPerItem, unit } = product;
  const unitText = unit === 'piece' ? `${unit}${numberOfItems !== 1 ? 's' : ''}` : 'items';
  return (
    <div className="text-right">
      <p className="text-base font-bold text-gray-900">{numberOfItems}<span className="ml-1 text-sm font-normal text-gray-600">{unitText}</span></p>
      {unit !== 'piece' && (<p className="text-xs text-gray-500">({quantityPerItem}{unit} each)</p>)}
    </div>
  );
};

const PaginationControls = ({ pagination, onPageChange, isLoading }: { pagination: Pagination | null, onPageChange: (page: number) => void, isLoading?: boolean }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { currentPage, totalPages, totalItems, limit } = pagination;
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalItems);
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t">
      <p className="text-sm text-gray-600">Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of <span className="font-medium">{totalItems}</span> results</p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={isLoading || currentPage === 1} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </button>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={isLoading || currentPage === totalPages} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );
};

// --- HistoryModal with Pagination (Unchanged) ---
const HistoryModal = ({ onClose, session }: { onClose: () => void; session: any }) => {
    const [history, setHistory] = useState<InventoryCheck[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
        if (!session) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/inventory-check?page=${currentPage}&limit=10`, {
                headers: { 'x-tenant-id': session.user.tenantId },
            });
            const data = await res.json();
            if (data.success) { 
            setHistory(data.history); 
            setPagination(data.pagination);
            } else { 
            toast.error(data.message || 'Failed to fetch audit history.'); 
            }
        } catch (error) {
            toast.error('Failed to fetch audit history.');
        } finally {
            setIsLoading(false);
        }
        };
        fetchHistory();
    }, [session, currentPage]);

    useEffect(() => { const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', handleEsc); return () => window.removeEventListener('keydown', handleEsc); }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in-fast">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col m-4 animate-slide-up-fast">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">Global Audit History</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"><X className="h-6 w-6" /></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected (Total)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual (Total)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Checked By</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {isLoading ? (<tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading history...</td></tr>) : 
                                history.map(check => (<tr key={check._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{check.product?.name || 'Deleted Product'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(check.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{check.expectedQuantity.toFixed(2)} {check.product?.unit || ''}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{check.actualQuantity.toFixed(2)} {check.product?.unit || ''}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${check.discrepancy === 0 ? 'bg-gray-100 text-gray-800' : check.discrepancy < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{check.discrepancy.toFixed(2)}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{check.checkedBy?.name || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{check.notes || '-'}</td>
                                </tr>))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <PaginationControls pagination={pagination} onPageChange={setCurrentPage} isLoading={isLoading} />
            </div>
        </div>
    );
};

// --- Main Page Component with Pagination ---
export default function InventoryCheckerPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [actualNumberOfItems, setActualNumberOfItems] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGlobalHistoryModalOpen, setIsGlobalHistoryModalOpen] = useState(false);
  
  const canCheckInventory = session && hasPermission(session.user.role.permissions, 'inventory-checker:create');
  const canReadInventory = session && hasPermission(session.user.role.permissions, 'inventory-checker:read');
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!session) return;
      setIsProductsLoading(true);
      try {
        // CHANGED: Limit is now set to 10
        const url = `/api/products?page=${currentPage}&limit=10&search=${debouncedSearchQuery}`;
        const res = await fetch(url, {
          headers: { 'x-tenant-id': session.user.tenantId },
        });
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (data.success) {
          setProducts(data.data);
          setPagination(data.pagination);
        } else {
          toast.error(data.message || "Failed to load products.");
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
        toast.error("An error occurred while fetching products.");
      } finally {
        setIsProductsLoading(false);
      }
    };
    fetchProducts();
  }, [session, currentPage, debouncedSearchQuery]);

  const handleToggleCheckForm = (productId: string) => {
    setExpandedProductId(prevId => (prevId === productId ? null : productId));
    setActualNumberOfItems('');
    setNotes('');
  };

  const handleViewGlobalHistory = () => setIsGlobalHistoryModalOpen(true);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const product = products.find(p => p._id === expandedProductId);
    if (!product || actualNumberOfItems === '') return;
    const actualCount = parseInt(actualNumberOfItems, 10);
    if (isNaN(actualCount)) { toast.error("Please enter a valid number."); return; }
    const hasDiscrepancy = product.numberOfItems !== actualCount;
    if (hasDiscrepancy && !notes.trim()) { toast.error("Notes are required when there is a discrepancy."); return; }
    setIsSubmitting(true);
    try {
      const newTotalQuantity = actualCount * product.quantityPerItem;
      const response = await fetch('/api/inventory-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId, },
        body: JSON.stringify({ productId: expandedProductId, actualQuantity: newTotalQuantity, notes }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to submit check.');
      toast.success('Inventory check submitted successfully!');
      setProducts(prevProducts => prevProducts.map(p => p._id === expandedProductId ? { ...p, totalQuantity: newTotalQuantity, numberOfItems: actualCount } : p));
      setExpandedProductId(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isSubmitDisabled = (product: Product) => {
    if (isSubmitting || !actualNumberOfItems) return true;
    const actualCount = parseInt(actualNumberOfItems, 10);
    if (isNaN(actualCount)) return true;
    const hasDiscrepancy = product.numberOfItems !== actualCount;
    return hasDiscrepancy && !notes.trim();
  };
  
  if (!canReadInventory) {
     return (
        <div className="flex items-center justify-center h-full p-6 text-center">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-xl font-semibold text-gray-800">Access Denied</h2>
            <p className="mt-2 text-gray-600">You do not have permission to access the inventory checker.</p>
          </div>
        </div>
     );
  }

  return (
    <>
      <div className="bg-slate-50 min-h-screen p-4 sm:p-6 md:p-8 space-y-6">
        <Toaster position="top-right" reverseOrder={false} />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inventory Checker</h1>
            <button onClick={handleViewGlobalHistory} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <History className="h-4 w-4" /> Audit History
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-md">
            <div className="p-4 border-b border-gray-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="text" placeholder="Search by Name, SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2 w-full sm:w-80 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isProductsLoading && ( <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading products...</td></tr> )}
                  {!isProductsLoading && products.length === 0 && ( <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">{searchQuery ? `No products matching "${searchQuery}" found.` : 'No products found.'}</td></tr> )}
                  
                  {!isProductsLoading && products.map((product) => (
                    <Fragment key={product._id}>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 align-middle"><div className="font-medium text-gray-900">{product.name}</div><div className="text-gray-500 text-xs mt-1">SKU: {product.sku}</div></td>
                        <td className="px-6 py-4 align-middle"><div className="text-gray-800 flex items-center gap-2 text-sm"><Building className="h-4 w-4 text-gray-400" /> {product.brand?.name || 'N/A'}</div><div className="text-gray-500 flex items-center gap-2 mt-1 text-xs"><Tag className="h-4 w-4 text-gray-400" /> {product.subCategory?.name || 'N/A'}</div></td>
                        <td className="px-6 py-4 align-middle">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${product.type === 'Retail' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                {product.type === 'Retail' ? <Package className="h-3 w-3"/> : <Warehouse className="h-3 w-3" />}
                                {product.type}
                            </span>
                        </td>
                        <td className="px-6 py-4 align-middle"><StockDisplay product={product} /></td>
                        <td className="px-6 py-4 text-center align-middle">
                          {canCheckInventory && (<button onClick={() => handleToggleCheckForm(product._id)} className={`inline-flex items-center px-4 py-1.5 text-xs font-medium rounded-md shadow-sm text-white ${expandedProductId === product._id ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-900'}`}>{expandedProductId === product._id ? 'Cancel' : 'Check'}</button>)}
                        </td>
                      </tr>
                      {expandedProductId === product._id && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="p-0">
                            <div className="p-4 animate-fade-in-fast">
                              <form onSubmit={handleSubmit} className="space-y-4 bg-white ring-1 ring-gray-200 p-4 rounded-lg shadow-inner">
                                <h3 className="font-semibold text-gray-800">New Inventory Count for {product.name}</h3>
                                <div>
                                  <label htmlFor={`actualNumberOfItems-${product._id}`} className="block text-sm font-medium text-gray-700">Actual Number of Items</label>
                                  <input id={`actualNumberOfItems-${product._id}`} type="number" step="1" value={actualNumberOfItems} onChange={(e) => setActualNumberOfItems(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" required autoFocus placeholder={`Current: ${product.numberOfItems}`} />
                                </div>
                                <div>
                                  <label htmlFor={`notes-${product._id}`} className="block text-sm font-medium text-gray-700">Notes {product.numberOfItems !== parseInt(actualNumberOfItems || `${product.numberOfItems}`, 10) && (<span className="text-red-500">*</span>)}</label>
                                  <textarea id={`notes-${product._id}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" placeholder="Required if count is different..." required={product.numberOfItems !== parseInt(actualNumberOfItems || `${product.numberOfItems}`, 10)}></textarea>
                                </div>
                                <button type="submit" disabled={isSubmitDisabled(product)} className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">{isSubmitting ? 'Submitting...' : 'Submit Count'}</button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls pagination={pagination} onPageChange={setCurrentPage} isLoading={isProductsLoading} />
        </div>
      </div>
      {isGlobalHistoryModalOpen && <HistoryModal session={session} onClose={() => setIsGlobalHistoryModalOpen(false)} />}
    </>
  );
}