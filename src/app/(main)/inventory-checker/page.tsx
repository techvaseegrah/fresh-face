// src/app/(main)/inventory-checker/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { Chart } from 'chart.js/auto';

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

export default function InventoryCheckerPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actualQuantity, setActualQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<InventoryCheck[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [chartInstance, setChartInstance] = useState<Chart | null>(null);

  const canCheckInventory = session && hasPermission(session.user.role.permissions, PERMISSIONS.INVENTORY_CHECKER_CREATE);
  const canReadInventory = session && hasPermission(session.user.role.permissions, PERMISSIONS.INVENTORY_CHECKER_READ);

  useEffect(() => {
    console.log('Checking permissions for inventory checker:', session?.user.role.permissions);
    
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');

        console.log('Fetching products from API:', res);
        
        const data = await res.json();
        if (data.success) {
          setProducts(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchHistory();
    }
  }, [selectedProduct]);

    const fetchHistory = async () => {
        if (!selectedProduct) return;
        setIsHistoryLoading(true);
        try {
            const res = await fetch(`/api/inventory-check?productId=${selectedProduct._id}`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.history);
                renderChart(data.history);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
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
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to submit inventory check.');
      }
      alert('Inventory check submitted successfully!');
      fetchHistory();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderChart = (data: InventoryCheck[]) => {
    const canvas = document.getElementById('usageChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const labels = data.map(item => new Date(item.date).toLocaleDateString()).reverse();
    const expectedData = data.map(item => item.expectedQuantity).reverse();
    const actualData = data.map(item => item.actualQuantity).reverse();
    const discrepancyData = data.map(item => item.discrepancy).reverse();

    const newChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Expected Quantity',
            data: expectedData,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          },
          {
            label: 'Actual Quantity',
            data: actualData,
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1
          },
          {
            label: 'Discrepancy',
            data: discrepancyData,
            borderColor: 'rgb(255, 205, 86)',
            tension: 0.1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
    setChartInstance(newChartInstance);
  };

  if (!canReadInventory) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <p className="text-red-500">You do not have permission to access the inventory checker.</p>
      </div>
    );
  }
console.log(history);



  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Inventory Checker</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-800 mb-4">Check Product Inventory</h2>
        {canCheckInventory && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="product" className="block text-sm font-medium text-gray-700">
                Select Product
              </label>
              <select
                id="product"
                value={selectedProduct?._id || ''}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"
                required
              >
                <option value="">-- Select a product --</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <>
                <div>
                  <label
                    htmlFor="actualQuantity"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Current Quantity ({selectedProduct.unit})
                  </label>
                  <input
                    id="actualQuantity"
                    type="number"
                    step="any"
                    value={actualQuantity}
                    onChange={(e) => setActualQuantity(e.target.value)}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"
                    rows={3}
                  ></textarea>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Check'}
                </button>
              </>
            )}
          </form>
        )}
      </div>

      {selectedProduct && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Inventory History for {selectedProduct.name}</h2>
          {isHistoryLoading ? (
            <p>Loading history...</p>
          ) : (
            <>
              <div className="mb-6">
                <canvas id="usageChart"></canvas>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Discrepancy</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Checked By</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map(check => (
                    <tr key={check._id}>
                      <td className="px-4 py-2">{new Date(check.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2">{check.expectedQuantity.toFixed(2)}</td>
                      <td className="px-4 py-2">{check.actualQuantity.toFixed(2)}</td>
                      <td className={`px-4 py-2 font-semibold ${check.discrepancy < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {check.discrepancy.toFixed(2)}
                      </td>
                        <td className="px-4 py-2">{check.checkedBy?.name}</td>
                      <td className="px-4 py-2">{check.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}