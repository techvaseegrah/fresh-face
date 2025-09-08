'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, getSession } from 'next-auth/react'; // Import getSession
import { toast } from 'react-toastify';

// 1. IMPORT HELPERS AND ICONS
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { IPurchaseOrder } from '@/types/procurement';
import PurchaseOrderModal from './components/PurchaseOrderModal';
import ReceiveStockModal from './components/ReceiveStockModal';
import { DocumentTextIcon, PlusIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';


//================================================================================
//  Main Procurement Page Component
//================================================================================
export default function ProcurementPage() {
  const { data: session } = useSession();

  // 2. DERIVE PERMISSIONS AT THE TOP
  const userPermissions = session?.user?.role?.permissions || [];
  const canReadOwn = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_OWN);
  const canReadAll = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_READ_ALL);
  const canCreate = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_CREATE);
  const canReceive = hasPermission(userPermissions, PERMISSIONS.WORKFLOW_PO_RECEIVE);
  
  // --- State Management ---
  const [purchaseOrders, setPurchaseOrders] = useState<IPurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [editingPo, setEditingPo] = useState<IPurchaseOrder | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivingPo, setReceivingPo] = useState<IPurchaseOrder | null>(null);
  
  // 3. TENANT-AWARE FETCH HELPER (Pattern from DashboardPage.tsx)
  // This function is defined locally and handles adding the tenant header.
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    // getSession() can be called inside functions, unlike the useSession() hook.
    const currentSession = await getSession(); 
    if (!currentSession?.user?.tenantId) {
      toast.error("Session error: Tenant not found. Please log in again.");
      throw new Error("Missing tenant ID in session");
    }
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      'x-tenant-id': currentSession.user.tenantId,
    };
    // Return the fetch promise directly, for the caller to handle.
    return fetch(url, { ...options, headers });
  }, []);

  // --- Tenant-Aware Data Fetching ---
  const fetchPurchaseOrders = useCallback(async () => {
    if (!canReadOwn && !canReadAll) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await tenantFetch('/api/procurement/purchase-orders');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch purchase orders');
      }

      const data = await response.json();
      setPurchaseOrders(data);
    } catch (err: any) {
      // Don't show toast if the error is due to missing tenant ID, as tenantFetch already does.
      if (!err.message.includes("Missing tenant ID")) {
        toast.error(err.message);
      }
      setPurchaseOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [canReadOwn, canReadAll, tenantFetch]);
  
  useEffect(() => {
    if (session && (canReadOwn || canReadAll)) {
      fetchPurchaseOrders();
    } else if (session) {
      setIsLoading(false);
    }
  }, [session, canReadOwn, canReadAll, fetchPurchaseOrders]);

  // --- Modal Handlers ---
  const handleOpenPoModal = (po: IPurchaseOrder | null) => {
    setEditingPo(po);
    setIsPoModalOpen(true);
  };

  const handleOpenReceiveModal = (po: IPurchaseOrder) => {
    setReceivingPo(po);
    setIsReceiveModalOpen(true);
  };
  
  //================================================================================
  //  JSX Structure with Permission Gate
  //================================================================================

  if (!session) {
    return <div>Loading session...</div>;
  }
  
  // 4. PERMISSION GATE (Identical to DashboardPage.tsx)
  if (!isLoading && !canReadOwn && !canReadAll) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
        <div className="text-center bg-white p-10 rounded-xl shadow-md border border-red-200">
          <ShieldExclamationIcon className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-bold text-gray-800">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have the required permissions to view this page.</p>
        </div>
      </div>
    );
  }

  // --- Main Return Block ---
  return (
    <>
      <div className="bg-gray-50 min-h-screen p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Procurement Workflow</h1>
            <p className="text-sm text-gray-500">Create, review, and manage purchase orders.</p>
          </div>
          {canCreate && (
            <button onClick={() => handleOpenPoModal(null)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              <PlusIcon className="h-5 w-5" /> New Purchase Order
            </button>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-lg shadow-md">
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
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500 font-medium">Loading purchase orders...</td></tr>
                ) : purchaseOrders.length > 0 ? (
                  purchaseOrders.map((po) => (
                    <tr key={po._id.toString()} className="hover:bg-indigo-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm font-medium text-indigo-700">{po.poId}</div><div className="text-xs text-gray-500">Created: {new Date(po.createdAt).toLocaleDateString('en-GB')}</div></td>
                      <td className="px-4 py-4 whitespace-nowrap"><span className={`py-1 px-3 rounded-full text-xs font-semibold ${po.status === 'Approved' ? 'bg-green-200 text-green-700' : ''} ${po.status === 'Pending Owner Approval' ? 'bg-yellow-200 text-yellow-700' : ''} ${po.status === 'Pending Admin Review' ? 'bg-orange-200 text-orange-700' : ''} ${po.status === 'Received' || po.status === 'Partially Received' ? 'bg-blue-200 text-blue-700' : ''} ${po.status === 'Cancelled' ? 'bg-red-200 text-red-700' : ''} ${po.status === 'Ordered' ? 'bg-purple-200 text-purple-700' : ''}`}>{po.status}</span></td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{po.createdBy.name || 'N/A'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(po.expectedDeliveryDate).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-800 font-medium">{po.products.length}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium"><div className="flex items-center justify-center gap-x-4"><button onClick={() => handleOpenPoModal(po)} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="View/Edit">View Details</button>{canReceive && ['Approved', 'Ordered', 'Partially Received'].includes(po.status) && (<button onClick={() => handleOpenReceiveModal(po)} className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-green-700" title="Receive Stock">Receive Stock</button>)}</div></td>
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

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center text-gray-500 font-medium">Loading purchase orders...</div>
            </div>
          ) : purchaseOrders.length > 0 ? (
            purchaseOrders.map((po) => (
              <div key={po._id.toString()} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
                {/* Header with PO ID and Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-700">{po.poId}</h3>
                    <p className="text-xs text-gray-500">Created: {new Date(po.createdAt).toLocaleDateString('en-GB')}</p>
                  </div>
                  <span className={`py-1 px-3 rounded-full text-xs font-semibold ${po.status === 'Approved' ? 'bg-green-200 text-green-700' : ''} ${po.status === 'Pending Owner Approval' ? 'bg-yellow-200 text-yellow-700' : ''} ${po.status === 'Pending Admin Review' ? 'bg-orange-200 text-orange-700' : ''} ${po.status === 'Received' || po.status === 'Partially Received' ? 'bg-blue-200 text-blue-700' : ''} ${po.status === 'Cancelled' ? 'bg-red-200 text-red-700' : ''} ${po.status === 'Ordered' ? 'bg-purple-200 text-purple-700' : ''}`}>
                    {po.status}
                  </span>
                </div>

                {/* Details Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Created By:</span>
                    <span className="text-sm text-gray-800">{po.createdBy.name || 'N/A'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Delivery Date:</span>
                    <span className="text-sm text-gray-600">{new Date(po.expectedDeliveryDate).toLocaleDateString('en-GB')}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Total Items:</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {po.products.length}
                    </span>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={() => handleOpenPoModal(po)} 
                      className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      View Details
                    </button>
                    {canReceive && ['Approved', 'Ordered', 'Partially Received'].includes(po.status) && (
                      <button 
                        onClick={() => handleOpenReceiveModal(po)} 
                        className="flex-1 bg-green-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      >
                        Receive Stock
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
              <div className="text-center">
                <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm font-medium">No purchase orders found.</p>
                <p className="text-gray-400 text-xs mt-1">Click 'New Purchase Order' to get started.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. PASS tenantFetch DOWN TO MODALS */}
      {/* This allows modals to make their own tenant-aware POST/PUT requests */}
      {isPoModalOpen && (
        <PurchaseOrderModal 
          isOpen={isPoModalOpen}
          onClose={() => setIsPoModalOpen(false)}
          po={editingPo}
          onSuccess={fetchPurchaseOrders}
          tenantFetch={tenantFetch}
        />
      )}

      {isReceiveModalOpen && (
        <ReceiveStockModal
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          po={receivingPo!} 
          onSuccess={fetchPurchaseOrders}
          tenantFetch={tenantFetch}
        />
      )}
    </>
  );
}