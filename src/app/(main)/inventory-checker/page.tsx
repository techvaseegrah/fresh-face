'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';
import { Chart } from 'chart.js/auto';
import { Toaster, toast } from 'react-hot-toast';
import { Package, Warehouse, History, X, Search, AlertTriangle, Building, Tag } from 'lucide-react';

// --- Interface Definitions (Matching Your Schema) ---

// Defines the structure for a populated Mongoose reference.
interface PopulatedRef {
  _id: string;
  name: string;
}

// Represents a product object, matching your IProduct schema on the frontend.
interface Product {
  _id: string;
  sku: string;
  name: string;
  brand: PopulatedRef;
  subCategory: PopulatedRef;
  type: 'Retail' | 'In-House';
  totalQuantity: number;
  numberOfItems: number;
  quantityPerItem: number;
  unit: 'ml' | 'g' | 'kg' | 'l' | 'piece';
}

// Represents a historical inventory check record.
interface InventoryCheck {
  _id: string;
  product: Product;
  date: string;
  expectedQuantity: number;
  actualQuantity: number;
  discrepancy: number;
  notes?: string;
  checkedBy: { name: string };
}


// --- Helper Component: StockDisplay ---
// This component formats the stock quantity based on your specific schema fields.
const StockDisplay = ({ product }: { product: Product }) => {
  const { numberOfItems, quantityPerItem, unit } = product;

  // If the unit is 'piece', we only need to show the number of items.
  if (unit === 'piece') {
    return (
      <div className="text-right">
        <p className="text-xl font-bold text-gray-800">
          {numberOfItems}
          <span className="text-base font-normal text-gray-500"> {unit}{numberOfItems !== 1 ? 's' : ''}</span>
        </p>
      </div>
    );
  }

  // For all other units, display both the item count and their individual capacity.
  return (
    <div className="text-right">
      <p className="text-xl font-bold text-gray-800">
        {numberOfItems}
        <span className="text-base font-normal text-gray-500"> items</span>
      </p>
      <p className="text-sm text-gray-600">
        ({quantityPerItem}{unit} each)
      </p>
    </div>
  );
};


// --- Child Component: HistoryModal ---
// This modal displays a product's inventory history with a chart and a detailed table.
const HistoryModal = ({ onClose, history, productName }: { onClose: () => void; history: InventoryCheck[]; productName: string; }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Effect to close the modal when the 'Escape' key is pressed.
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Effect to create and manage the Chart.js instance.
  useEffect(() => {
    if (history.length > 0 && chartCanvasRef.current) {
      const ctx = chartCanvasRef.current.getContext('2d');
      if (!ctx) return;

      // Destroy any existing chart to prevent memory leaks and rendering issues.
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: history.map(item => new Date(item.date).toLocaleDateString()).reverse(),
          datasets: [
            { label: 'Expected', data: history.map(item => item.expectedQuantity).reverse(), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 },
            { label: 'Actual', data: history.map(item => item.actualQuantity).reverse(), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    // Cleanup function to destroy the chart when the component is unmounted.
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [history]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in-fast">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4 animate-slide-up-fast">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Inventory History: {productName}</h2>
          <button onClick={onClose} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-8 overflow-y-auto">
          <div className="h-80 border border-gray-200 rounded-lg p-4">
            <canvas ref={chartCanvasRef}></canvas>
          </div>
          <div className="overflow-x-auto">
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
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${check.discrepancy === 0 ? 'bg-gray-100 text-gray-800' : check.discrepancy < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{check.discrepancy.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{check.checkedBy?.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{check.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

  // State for the inline inventory check form
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [actualNumberOfItems, setActualNumberOfItems] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for the history modal
  const [history, setHistory] = useState<InventoryCheck[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyModalProduct, setHistoryModalProduct] = useState<Product | null>(null);

  // Check user permissions
  const canCheckInventory = session && hasPermission(session.user.role.permissions, 'inventory-checker:create');
  const canReadInventory = session && hasPermission(session.user.role.permissions, 'inventory-checker:read');
  
  // Effect to fetch all products when the component mounts
  useEffect(() => {
    const fetchProducts = async () => {
      setIsProductsLoading(true);
      try {
        // IMPORTANT: Ensure this API endpoint populates 'brand' and 'subCategory'
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (data.success) {
          setProducts(data.data);
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
  }, []);

  // Handler to toggle the visibility of the inline check form
  const handleToggleCheckForm = (productId: string) => {
    setExpandedProductId(prevId => (prevId === productId ? null : productId));
    setActualNumberOfItems('');
    setNotes('');
  };

  // Handler to fetch data and open the history modal
  const handleViewHistory = async (product: Product) => {
    setHistoryModalProduct(product);
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`/api/inventory-check?productId=${product._id}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      } else {
        toast.error(data.message || 'Failed to fetch history.');
      }
    } catch (error) {
      toast.error('Failed to fetch history.');
    } finally {
      setIsHistoryLoading(false);
    }
  };
  
  // Handler to submit the new inventory count
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p._id === expandedProductId);
    if (!product || actualNumberOfItems === '') return;
    
    setIsSubmitting(true);
    try {
      // Calculate the new total quantity based on the number of items and quantity per item
      const newTotalQuantity = parseFloat(actualNumberOfItems) * product.quantityPerItem;

      const response = await fetch('/api/inventory-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: expandedProductId,
          actualQuantity: newTotalQuantity, // Send the calculated total
          notes,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to submit check.');
      
      toast.success('Inventory check submitted successfully!');
      
      // Update local state for immediate UI feedback without a full refresh
      setProducts(prevProducts => prevProducts.map(p => 
          p._id === expandedProductId 
            ? { ...p, totalQuantity: newTotalQuantity, numberOfItems: parseInt(actualNumberOfItems) } 
            : p
      ));
      
      setExpandedProductId(null); // Close the form
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Filter products based on the search query before rendering them
  const filteredProducts = products.filter(product =>
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Group the filtered products by their 'type'
  const retailProducts = filteredProducts.filter(p => p.type === 'Retail');
  const inHouseProducts = filteredProducts.filter(p => p.type === 'In-House');

  // Render an access denied message if the user lacks permissions
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

  // A reusable function to render a product list for a given category
  const renderProductList = (title: string, icon: React.ReactNode, productList: Product[]) => (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-800 flex items-center">{icon}{title}</h2>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {productList.length === 0 && !isProductsLoading && ( <li className="p-6 text-center text-gray-500">{searchQuery ? `No products with SKU matching "${searchQuery}" found.` : 'No products found in this category.'}</li> )}
          {productList.map((product) => (
            <Fragment key={product._id}>
              <li className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-4">
                  {/* Product Details Section */}
                  <div className="flex-1 min-w-[250px]">
                    <p className="text-lg font-semibold text-gray-900">{product.name}</p>
                    <div className="text-sm text-gray-500 space-y-1 mt-1">
                      <p>SKU: <span className="font-medium text-gray-700">{product.sku}</span></p>
                      <p className="flex items-center"><Building className="h-4 w-4 mr-2 text-gray-400" />Brand: <span className="font-medium text-gray-700 ml-1">{product.brand?.name || 'N/A'}</span></p>
                      <p className="flex items-center"><Tag className="h-4 w-4 mr-2 text-gray-400" />Subcategory: <span className="font-medium text-gray-700 ml-1">{product.subCategory?.name || 'N/A'}</span></p>
                    </div>
                  </div>
                  {/* Stock Display Section */}
                  <div className="flex-shrink-0">
                    <p className="text-sm text-gray-500 text-right mb-1">Current Stock</p>
                    <StockDisplay product={product} />
                  </div>
                  {/* Action Buttons Section */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                     <button onClick={() => handleViewHistory(product)} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label={`View history for ${product.name}`}><History className="h-5 w-5" /></button>
                    {canCheckInventory && (<button onClick={() => handleToggleCheckForm(product._id)} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${expandedProductId === product._id ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-900'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors`}>{expandedProductId === product._id ? 'Cancel' : 'Check'}</button>)}
                  </div>
                </div>
              </li>
              {/* Inline Inventory Check Form */}
              {expandedProductId === product._id && (
                <li className="bg-gray-50 p-6 animate-fade-in-fast">
                  <form onSubmit={handleSubmit} className="space-y-4 ring-2 ring-blue-200 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-800">New Inventory Count for {product.name}</h3>
                    <div>
                      <label htmlFor={`actualNumberOfItems-${product._id}`} className="block text-sm font-medium text-gray-700">Actual Number of Items</label>
                      <input id={`actualNumberOfItems-${product._id}`} type="number" step="1" value={actualNumberOfItems} onChange={(e) => setActualNumberOfItems(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" required autoFocus placeholder="e.g., 10" />
                    </div>
                    <div>
                      <label htmlFor={`notes-${product._id}`} className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                      <textarea id={`notes-${product._id}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" placeholder="Any reasons for discrepancy..."></textarea>
                    </div>
                    <button type="submit" disabled={isSubmitting || !actualNumberOfItems} className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed">{isSubmitting ? 'Submitting...' : 'Submit Count'}</button>
                  </form>
                </li>
              )}
            </Fragment>
          ))}
        </ul>
        {isProductsLoading && <p className="p-6 text-center text-gray-500">Loading products...</p>}
      </div>
    </div>
  );

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8 space-y-8">
        <Toaster position="top-right" reverseOrder={false} />
        {/* Page Header and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inventory Checker</h1>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Search by SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2 w-full sm:w-64 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
        
        {/* Render the categorized product lists */}
        {renderProductList('Retail Products', <Package className="h-7 w-7 mr-3 text-blue-600" />, retailProducts)}
        {renderProductList('In-House Stock', <Warehouse className="h-7 w-7 mr-3 text-green-600" />, inHouseProducts)}
      </div>

      {/* Conditionally render the history modal when a product is selected for history view */}
      {historyModalProduct && (<HistoryModal onClose={() => setHistoryModalProduct(null)} history={history} productName={historyModalProduct.name} />)}
    </>
  );
}