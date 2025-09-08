'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';
import { Chart } from 'chart.js/auto';
import { Toaster, toast } from 'react-hot-toast';
import { Package, Warehouse, History, X, Search, AlertTriangle, Building, Tag, FileDown } from 'lucide-react';

// --- Interface Definitions (Unchanged) ---
interface PopulatedRef { _id: string; name: string; }
interface Product { _id: string; sku: string; name: string; brand: PopulatedRef; subCategory: PopulatedRef; type: 'Retail' | 'In-House'; totalQuantity: number; numberOfItems: number; quantityPerItem: number; unit: 'ml' | 'g' | 'kg' | 'l' | 'piece'; }
interface InventoryCheck { _id: string; product: Product; date: string; expectedQuantity: number; actualQuantity: number; discrepancy: number; notes?: string; checkedBy: { name: string }; }

// --- Helper Component: StockDisplay (Unchanged) ---
const StockDisplay = ({ product }: { product: Product }) => {
  const { numberOfItems, quantityPerItem, unit } = product;
  if (unit === 'piece') { return (<div className="text-right"><p className="text-xl font-bold text-gray-800">{numberOfItems}<span className="text-base font-normal text-gray-500"> {unit}{numberOfItems !== 1 ? 's' : ''}</span></p></div>); }
  return (<div className="text-right"><p className="text-xl font-bold text-gray-800">{numberOfItems}<span className="text-base font-normal text-gray-500"> items</span></p><p className="text-xs text-gray-600">({quantityPerItem}{unit} each)</p></div>);
};

// --- Child Component: HistoryModal (Unchanged) ---
const HistoryModal = ({ onClose, history, productName }: { onClose: () => void; history: InventoryCheck[]; productName: string; }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => { const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', handleEsc); return () => window.removeEventListener('keydown', handleEsc); }, [onClose]);
  useEffect(() => {
    if (history.length > 0 && chartCanvasRef.current) {
      const ctx = chartCanvasRef.current.getContext('2d');
      if (!ctx) return;
      if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); }
      chartInstanceRef.current = new Chart(ctx, { type: 'line', data: { labels: history.map(item => new Date(item.date).toLocaleDateString()).reverse(), datasets: [ { label: 'Expected', data: history.map(item => item.expectedQuantity).reverse(), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 }, { label: 'Actual', data: history.map(item => item.actualQuantity).reverse(), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }, ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } }, scales: { y: { beginAtZero: true } } } });
    }
    return () => { if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); chartInstanceRef.current = null; } };
  }, [history]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in-fast p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up-fast">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 pr-4">Inventory History: {productName}</h2>
          <button onClick={onClose} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-y-auto">
          {/* Chart */}
          <div className="h-64 sm:h-80 border border-gray-200 rounded-lg p-4">
            <canvas ref={chartCanvasRef}></canvas>
          </div>
          
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected (Total)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual (Total)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Checked By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map(check => (
                  <tr key={check._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(check.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{check.expectedQuantity.toFixed(2)} {check.product.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{check.actualQuantity.toFixed(2)} {check.product.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        check.discrepancy === 0 ? 'bg-gray-100 text-gray-800' : 
                        check.discrepancy < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {check.discrepancy.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{check.checkedBy?.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{check.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {history.map(check => (
              <div key={check._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(check.date).toLocaleDateString()}
                  </div>
                  <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    check.discrepancy === 0 ? 'bg-gray-100 text-gray-800' : 
                    check.discrepancy < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {check.discrepancy.toFixed(2)}
                  </span>
                </div>
                
                {/* Details */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Expected:</span>
                    <span className="text-sm text-gray-600">{check.expectedQuantity.toFixed(2)} {check.product.unit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Actual:</span>
                    <span className="text-sm text-gray-900 font-medium">{check.actualQuantity.toFixed(2)} {check.product.unit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Checked By:</span>
                    <span className="text-sm text-gray-600">{check.checkedBy?.name || 'N/A'}</span>
                  </div>
                  {check.notes && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Notes:</span>
                      <p className="text-sm text-gray-600 mt-1">{check.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component: InventoryCheckerPage ---
export default function InventoryCheckerPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [actualNumberOfItems, setActualNumberOfItems] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<InventoryCheck[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyModalProduct, setHistoryModalProduct] = useState<Product | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const canCheckInventory = session && hasPermission(session.user.role.permissions, 'inventory-checker:create');
  const canReadInventory = session && hasPermission(session.user.role.permissions, 'inventory-checker:read');
  
  useEffect(() => {
    const fetchProducts = async () => {
      if (!session) return; // Wait for the session to be available
      setIsProductsLoading(true);
      try {
        const res = await fetch('/api/products', {
          headers: {
            'x-tenant-id': session.user.tenantId,
          },
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Network response was not ok');
        }
        const data = await res.json();
        if (data.success) { setProducts(data.data); } 
        else { toast.error(data.message || "Failed to load products."); }
      } catch (error: any) {
        console.error('Failed to fetch products:', error);
        toast.error(error.message || "An error occurred while fetching products.");
      } finally {
        setIsProductsLoading(false);
      }
    };
    fetchProducts();
  }, [session]); // --- MODIFIED: Added session as a dependency

  const handleToggleCheckForm = (productId: string) => {
    setExpandedProductId(prevId => (prevId === productId ? null : productId));
    setActualNumberOfItems('');
    setNotes('');
  };

  const handleViewHistory = async (product: Product) => {
    if (!session) return; // Guard clause
    setHistoryModalProduct(product);
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`/api/inventory-check?productId=${product._id}`, {
        headers: {
          'x-tenant-id': session.user.tenantId,
        },
      });
      const data = await res.json();
      if (data.success) { setHistory(data.history); } 
      else { toast.error(data.message || 'Failed to fetch history.'); }
    } catch (error) {
      toast.error('Failed to fetch history.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleExport = async () => {
    if (!session) return; // Guard clause
    setIsExporting(true);
    toast.loading('Generating your report...', { id: 'export-toast' });
    try {
      const response = await fetch('/api/inventory-check/export', {
        headers: {
          'x-tenant-id': session.user.tenantId,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate report. Please try again.');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'InventoryCheckReport.xlsx';
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
        if (fileNameMatch && fileNameMatch.length === 2) {
          fileName = fileNameMatch[1];
        }
      }
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully!', { id: 'export-toast' });
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred.', { id: 'export-toast' });
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return; // Guard clause

    const product = products.find(p => p._id === expandedProductId);
    if (!product || actualNumberOfItems === '') return;
    
    const actualCount = parseInt(actualNumberOfItems, 10);
    if (isNaN(actualCount)) { toast.error("Please enter a valid number."); return; }
    
    const hasDiscrepancy = product.numberOfItems !== actualCount;
    if (hasDiscrepancy && !notes.trim()) {
        toast.error("Notes are required when there is a discrepancy.");
        return;
    }

    setIsSubmitting(true);
    try {
      const newTotalQuantity = actualCount * product.quantityPerItem;
      const response = await fetch('/api/inventory-check', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': session.user.tenantId,
        },
        body: JSON.stringify({ productId: expandedProductId, actualQuantity: newTotalQuantity, notes }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to submit check.');
      toast.success('Inventory check submitted successfully!');
      setProducts(prevProducts => prevProducts.map(p => 
          p._id === expandedProductId 
            ? { ...p, totalQuantity: newTotalQuantity, numberOfItems: actualCount } 
            : p
      ));
      setExpandedProductId(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.brand && product.brand.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (product.subCategory && product.subCategory.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const retailProducts = filteredProducts.filter(p => p.type === 'Retail');
  const inHouseProducts = filteredProducts.filter(p => p.type === 'In-House');

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

  const renderProductTable = (title: string, icon: React.ReactNode, productList: Product[]) => {
    const isSubmitDisabled = (product: Product) => {
        if (isSubmitting || !actualNumberOfItems) {
            return true;
        }
        const actualCount = parseInt(actualNumberOfItems, 10);
        if (isNaN(actualCount)) {
            return true;
        }
        const hasDiscrepancy = product.numberOfItems !== actualCount;
        if (hasDiscrepancy && !notes.trim()) {
            return true;
        }
        return false;
    };

    return (
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center mt-8">{icon}{title}</h2>
        
        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Current Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isProductsLoading && ( <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Loading products...</td></tr> )}
                {!isProductsLoading && productList.length === 0 && ( <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">{searchQuery ? `No products matching "${searchQuery}" found.` : 'No products found in this category.'}</td></tr> )}
                {!isProductsLoading && productList.map((product) => (
                  <Fragment key={product._id}>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 align-middle"><div className="font-medium text-gray-900">{product.name}</div><div className="text-gray-500">SKU: {product.sku}</div></td>
                      <td className="px-6 py-4 align-middle"><div className="text-gray-800 flex items-center gap-2"><Building className="h-4 w-4 text-gray-400" /> {product.brand?.name || 'N/A'}</div><div className="text-gray-500 flex items-center gap-2 mt-1"><Tag className="h-4 w-4 text-gray-400" /> {product.subCategory?.name || 'N/A'}</div></td>
                      <td className="px-6 py-4 align-middle"><StockDisplay product={product} /></td>
                      <td className="px-6 py-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleViewHistory(product)} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-blue-600" aria-label={`View history for ${product.name}`}><History className="h-5 w-5" /></button>
                          {canCheckInventory && (<button onClick={() => handleToggleCheckForm(product._id)} className={`inline-flex items-center px-4 py-1.5 text-xs font-medium rounded-md shadow-sm text-white ${expandedProductId === product._id ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-900'}`}>{expandedProductId === product._id ? 'Cancel' : 'Check'}</button>)}
                        </div>
                      </td>
                    </tr>
                    {expandedProductId === product._id && (
                      <tr className="bg-blue-50/50">
                        <td colSpan={4} className="p-0">
                          <div className="p-6 animate-fade-in-fast">
                            <form onSubmit={handleSubmit} className="space-y-4 bg-white ring-1 ring-blue-200 p-4 rounded-lg shadow-inner">
                              <h3 className="font-semibold text-gray-800">New Inventory Count for {product.name}</h3>
                              <div>
                                <label htmlFor={`actualNumberOfItems-${product._id}`} className="block text-sm font-medium text-gray-700 mb-2">Actual Number of Items</label>
                                <input id={`actualNumberOfItems-${product._id}`} type="number" step="1" value={actualNumberOfItems} onChange={(e) => setActualNumberOfItems(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2" required autoFocus placeholder="e.g., 10" />
                              </div>
                              <div>
                                <label htmlFor={`notes-${product._id}`} className="block text-sm font-medium text-gray-700 mb-2">Notes <span className="text-red-500">*</span></label>
                                <textarea id={`notes-${product._id}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2" placeholder="e.g., Damaged item, expired stock, etc." required={product.numberOfItems !== parseInt(actualNumberOfItems || '0', 10)}></textarea>
                                <p className="text-xs text-gray-500 mt-1">Required if there is a discrepancy between expected ({product.numberOfItems}) and actual count.</p>
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
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {isProductsLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center text-gray-500">Loading products...</div>
            </div>
          )}
          {!isProductsLoading && productList.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
              <div className="text-center text-gray-500">
                {searchQuery ? `No products matching "${searchQuery}" found.` : 'No products found in this category.'}
              </div>
            </div>
          )}
          {!isProductsLoading && productList.map((product) => (
            <div key={product._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Card Header */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{product.name}</h3>
                    <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <StockDisplay product={product} />
                  </div>
                </div>
                
                {/* Category Information */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Brand:</span>
                    <span>{product.brand?.name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Tag className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Category:</span>
                    <span>{product.subCategory?.name || 'N/A'}</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-200">
                  <button 
                    onClick={() => handleViewHistory(product)} 
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <History className="h-4 w-4" />
                    View History
                  </button>
                  {canCheckInventory && (
                    <button 
                      onClick={() => handleToggleCheckForm(product._id)} 
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        expandedProductId === product._id 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : 'bg-gray-800 hover:bg-gray-900 text-white'
                      }`}
                    >
                      {expandedProductId === product._id ? 'Cancel' : 'Check'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Expanded Form */}
              {expandedProductId === product._id && (
                <div className="px-4 pb-4">
                  <div className="bg-blue-50 rounded-lg p-4 animate-fade-in-fast">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <h3 className="font-semibold text-gray-800 text-center">New Inventory Count for {product.name}</h3>
                      <div>
                        <label htmlFor={`mobile-actualNumberOfItems-${product._id}`} className="block text-sm font-medium text-gray-700 mb-2">Actual Number of Items</label>
                        <input 
                          id={`mobile-actualNumberOfItems-${product._id}`} 
                          type="number" 
                          step="1" 
                          value={actualNumberOfItems} 
                          onChange={(e) => setActualNumberOfItems(e.target.value)} 
                          className="w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm py-2.5 px-3" 
                          required 
                          autoFocus 
                          placeholder="e.g., 10" 
                        />
                      </div>
                      <div>
                        <label htmlFor={`mobile-notes-${product._id}`} className="block text-sm font-medium text-gray-700 mb-2">
                          Notes <span className="text-red-500">*</span>
                        </label>
                        <textarea 
                          id={`mobile-notes-${product._id}`} 
                          value={notes} 
                          onChange={(e) => setNotes(e.target.value)} 
                          rows={3} 
                          className="w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm py-2.5 px-3" 
                          placeholder="e.g., Damaged item, expired stock, etc." 
                          required={product.numberOfItems !== parseInt(actualNumberOfItems || '0', 10)}
                        ></textarea>
                        <p className="text-xs text-gray-500 mt-1">
                          Required if there is a discrepancy between expected ({product.numberOfItems}) and actual count.
                        </p>
                      </div>
                      <button 
                        type="submit" 
                        disabled={isSubmitDisabled(product)} 
                        className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Count'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="p-3 sm:p-6 lg:p-8">
        <Toaster position="top-right" reverseOrder={false} />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Inventory Checker</h1>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search by Name, SKU, Brand..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2.5 w-full sm:w-64 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-gray-400"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span>{isExporting ? 'Exporting...' : 'Export All'}</span>
            </button>
          </div>
        </div>
        
        {renderProductTable('Retail Products', <Package className="h-7 w-7 mr-3 text-blue-600" />, retailProducts)}
        {renderProductTable('In-House Stock', <Warehouse className="h-7 w-7 mr-3 text-green-600" />, inHouseProducts)}
      </div>

        {historyModalProduct && (<HistoryModal onClose={() => setHistoryModalProduct(null)} history={history} productName={historyModalProduct.name} />)}
    </>
  );
}