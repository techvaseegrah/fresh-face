'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { IPurchaseOrder } from '@/types/procurement';
import PurchaseOrderModal from './components/PurchaseOrderModal';
import ReceiveStockModal from './components/ReceiveStockModal';

export default function ProcurementPage() {
  const { data: session } = useSession();
  
  const [purchaseOrders, setPurchaseOrders] = useState<IPurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [editingPo, setEditingPo] = useState<IPurchaseOrder | null>(null);

const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
const [receivingPo, setReceivingPo] = useState<IPurchaseOrder | null>(null);

const userPermissions = session?.user?.role?.permissions || [];
const canReadOwn = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_OWN);
const canReadAll = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_ALL);
const canCreate = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_CREATE);
const canReceive = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_RECEIVE);
  
  const fetchPurchaseOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/procurement/purchase-orders');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch purchase orders');
      }
      
      const data = await response.json();
      setPurchaseOrders(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (canReadOwn || canReadAll) {
      fetchPurchaseOrders();
    }
  }, [session]);

  const handleOpenPoModal = (po: IPurchaseOrder | null) => {
    setEditingPo(po);
    setIsPoModalOpen(true);
  };

  const handleOpenReceiveModal = (po: IPurchaseOrder) => {
    setReceivingPo(po);
    setIsReceiveModalOpen(true);
  };
  
  if (!session) { return <div>Loading session...</div>; } // Show loading while session is fetched
  if (!canReadOwn && !canReadAll) {
    return ( <div className="p-6"><p className="text-red-500">You do not have permission to view this page.</p></div> );
  }


  return (
    <>
      <div className="bg-gray-50 min-h-screen p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Procurement Workflow</h1>
            <p className="text-sm text-gray-500">Create, review, and approve purchase orders.</p>
          </div>
          {/* This button will now correctly appear for any user with PROCUREMENT_CREATE permission */}
          {canCreate && (
            <button onClick={() => handleOpenPoModal(null)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-indigo-700">
              <PlusIcon className="h-5 w-5" /> New Purchase Order
            </button>
          )}
        </div>

        {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        <div className="bg-white rounded-lg shadow-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">PO ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Created By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Delivery Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Total Items</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading purchase orders...</td></tr>
                ) : purchaseOrders.length > 0 ? (
                  purchaseOrders.map((po) => (
                    <tr key={po._id.toString()} className="hover:bg-indigo-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-indigo-700">{po.poId}</div>
                        <div className="text-xs text-gray-500">Created: {new Date(po.createdAt).toLocaleDateString('en-GB')}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                         <span className={`py-1 px-3 rounded-full text-xs font-semibold
                          ${po.status === 'Approved' ? 'bg-green-200 text-green-700' : ''}
                          ${po.status === 'Pending Owner Approval' ? 'bg-yellow-200 text-yellow-700' : ''}
                          ${po.status === 'Pending Admin Review' ? 'bg-orange-200 text-orange-700' : ''}
                          ${po.status === 'Received' || po.status === 'Partially Received' ? 'bg-blue-200 text-blue-700' : ''}
                          ${po.status === 'Cancelled' ? 'bg-red-200 text-red-700' : ''}
                          ${po.status === 'Ordered' ? 'bg-purple-200 text-purple-700' : ''}
                        `}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">
                        {po.createdBy.name || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(po.expectedDeliveryDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-800 font-medium">
                        {po.products.length}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-x-4">
                        <button 
                            onClick={() => handleOpenPoModal(po)}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors" title="View/Edit"
                        >
                            View Details
                        </button>

                        {canReceive && ['Approved', 'Ordered', 'Partially Received'].includes(po.status) && (
      <button
        onClick={() => handleOpenReceiveModal(po)}
        className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-green-700"
        title="Receive Stock"
      >
        Receive Stock
      </button>
    )}

</div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="text-center py-12">
                        <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm font-medium">No purchase orders found.</p>
                        <p className="text-gray-400 text-xs mt-1">Click 'New Purchase Order' to get started.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isPoModalOpen && (
        <PurchaseOrderModal 
          isOpen={isPoModalOpen}
          onClose={() => setIsPoModalOpen(false)}
          po={editingPo}
          onSuccess={fetchPurchaseOrders}
        />
      )}

{isReceiveModalOpen && (
  <ReceiveStockModal
    isOpen={isReceiveModalOpen}
    onClose={() => setIsReceiveModalOpen(false)}
    // The '!' tells TypeScript we are sure receivingPo will not be null here
    po={receivingPo!} 
    onSuccess={fetchPurchaseOrders}
  />
)}
    </>
  );
}