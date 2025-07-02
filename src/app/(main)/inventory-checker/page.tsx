'use client';

import { useState, useEffect, useRef } from 'react'; 
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions'; 
import { Chart } from 'chart.js/auto';
import { Toaster, toast } from 'react-hot-toast';
import { CheckCircle, BarChart2, List, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';

// --- Interface Definitions ---
interface Product {
  _id: string;
  name: string;
  sku: string;
  totalQuantity: number;
  unit: string;
}

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

// --- History Modal Component ---
const HistoryModal = ({ onClose, history, productName }: { onClose: () => void; history: InventoryCheck[]; productName:string; }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (history.length > 0 && chartCanvasRef.current) {
        const ctx = chartCanvasRef.current.getContext('2d');
        if (!ctx) return;
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Checked By</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map(check => (
                  <tr key={check._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(check.date).toLocaleDateString()}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{check.expectedQuantity.toFixed(2)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{check.actualQuantity.toFixed(2)}</td><td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${check.discrepancy === 0 ? 'bg-gray-100 text-gray-800' : check.discrepancy < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{check.discrepancy.toFixed(2)}</span>
                    </td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{check.checkedBy?.name || 'N/A'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{check.notes || '-'}</td>
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


// --- Main Page Component ---
export default function InventoryCheckerPage() {
  const { data: session } = useSession(); 
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actualQuantity, setActualQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<InventoryCheck[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  const [isCheckFormVisible, setIsCheckFormVisible] = useState(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const canCheckInventory = session && hasPermission(session.user.role.permissions, 'inventory-checker:create');
  const canReadInventory = session && hasPermission(session.user.role.permissions, 'inventory-checker:read');


  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.success) setProducts(data.data);
        else toast.error("Failed to load products.");
      } catch (error) {
        console.error('Failed to fetch products:', error);
        toast.error("Failed to load products.");
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) fetchHistory();
    else setHistory([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  const fetchHistory = async () => {
    if (!selectedProduct) return;
    setIsHistoryLoading(true);
    try {
        const res = await fetch(`/api/inventory-check?productId=${selectedProduct._id}`);
        const data = await res.json();
        if (data.success) setHistory(data.history);
        else toast.error(data.message || 'Failed to fetch history.');
    } catch (error) {
        console.error('Failed to fetch history:', error);
        toast.error('Failed to fetch history.');
    } finally {
        setIsHistoryLoading(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p._id === productId);
    setSelectedProduct(product || null);
    setActualQuantity('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || actualQuantity === '') return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/inventory-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct._id,
          actualQuantity: parseFloat(actualQuantity),
          notes,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to submit inventory check.');
      toast.success('Inventory check submitted successfully!');
      fetchHistory();
      setActualQuantity('');
      setNotes('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="">
        <Toaster position="top-right" reverseOrder={false} />
        
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inventory Checker</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-4 bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <CheckCircle className="h-6 w-6 mr-3 text-blue-600" />
                Check Product Inventory
              </h2>
              <button onClick={() => setIsCheckFormVisible(!isCheckFormVisible)} className="p-1 text-gray-500 hover:text-gray-800 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {isCheckFormVisible ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </div>
            
            {isCheckFormVisible || canReadInventory && (
              <div className="animate-fade-in">
                {canCheckInventory||canReadInventory ? (
                  <form onSubmit={handleSubmit} className="space-y-6 pt-4 border-t">
                    <div>
                      <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
                      <select id="product" value={selectedProduct?._id || ''} onChange={(e) => handleProductSelect(e.target.value)} className="mt-1 block w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 transition" required>
                        <option value="">-- Select a product --</option>
                        {products.map((p) => (<option key={p._id} value={p._id}>{p.name} ({p.sku})</option>))}
                      </select>
                    </div>
                    {selectedProduct && (<>
                        <div>
                          <label htmlFor="actualQuantity" className="block text-sm font-medium text-gray-700 mb-1">Current Quantity ({selectedProduct.unit})</label>
                          <input id="actualQuantity" type="number" step="any" value={actualQuantity} onChange={(e) => setActualQuantity(e.target.value)} className="mt-1 block w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 transition" required placeholder={`e.g., 15.5`}/>
                        </div>
                        <div>
                          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 transition" rows={4} placeholder="Any observations or reasons for discrepancy..."></textarea>
                        </div>
                        {/* COLOR CHANGE HERE */}
                        <button type="submit" disabled={isSubmitting || !actualQuantity} className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all">
                          {isSubmitting ? 'Submitting...' : 'Submit Check'}
                        </button>
                    </>)}
                  </form>
                ) : (<p className="text-sm text-gray-500 italic pt-4 border-t">You don't have permission to perform inventory checks.</p>)}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg flex flex-col">
            {selectedProduct ? (
              <div className="flex flex-col items-center justify-center text-center h-full">
                <List className="h-12 w-12 text-green-600" />
                <h2 className="mt-4 text-xl font-semibold text-gray-800">
                  History for {selectedProduct.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {isHistoryLoading ? "Loading records..." : `${history.length} records found.`}
                </p>
                {/* COLOR CHANGE HERE */}
                <button
                  onClick={() => setIsHistoryModalOpen(true)}
                  disabled={isHistoryLoading || history.length === 0}
                  className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  View Full History
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <BarChart2 className="h-16 w-16 text-gray-300" />
                <p className="mt-4 text-lg font-medium">Select a product to view its history</p>
                <p className="mt-1 text-sm">Inventory charts and logs will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isHistoryModalOpen && selectedProduct && (
        <HistoryModal
          onClose={() => setIsHistoryModalOpen(false)}
          history={history}
          productName={selectedProduct.name}
        />
      )}
    </>
  );
}