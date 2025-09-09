'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PlusCircle, Edit, ListPlus, FileCheck2, Archive, Upload, ShieldAlert } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { ToolFormModal } from './components/ToolFormModal';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import { ToolImportModal } from './components/ToolImportModal';
// ▼▼▼ ADD THESE IMPORTS ▼▼▼
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
// ▲▲▲ END OF ADDITION ▲▲▲

interface ITool {
  _id: string;
  name: string;
  category: string;
  currentStock: number;
  maintenanceDueDate?: string;
}

export default function ToolStockPage() {
  const { data: session, status } = useSession();
  const [tools, setTools] = useState<ITool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for modals
  const [isToolFormModalOpen, setIsToolFormModalOpen] = useState(false);
  const [toolToEdit, setToolToEdit] = useState<ITool | null>(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [toolToAdjust, setToolToAdjust] = useState<ITool | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // ▼▼▼ DEFINE USER PERMISSIONS ▼▼▼
  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
  
  const canRead = useMemo(() => hasPermission(userPermissions, PERMISSIONS.TOOL_STOCK_READ), [userPermissions]);
  const canManage = useMemo(() => hasPermission(userPermissions, PERMISSIONS.TOOL_STOCK_MANAGE), [userPermissions]);
  const canAudit = useMemo(() => hasPermission(userPermissions, PERMISSIONS.TOOL_STOCK_AUDIT), [userPermissions]);
  const canUseReports = useMemo(() => hasPermission(userPermissions, PERMISSIONS.TOOL_STOCK_REPORTS), [userPermissions]);
  // ▲▲▲ END OF DEFINITION ▲▲▲


  const fetchTools = async () => {
    // Permission check before fetching
    if (!canRead) {
      setError('You do not have permission to view tool stock.');
      setLoading(false);
      return;
    }
    if (!session?.user?.tenantId) return;

    const url = new URL('/api/tool-stock/tools', window.location.origin);
    if (debouncedSearchTerm) {
      url.searchParams.append('search', debouncedSearchTerm);
    }
    
    try {
      setLoading(true);
      const response = await fetch(url.toString(), {
        headers: { 'x-tenant-id': session.user.tenantId },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch tools');
      }
      const data = await response.json();
      setTools(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTools();
    } else if (status === 'unauthenticated') {
      setError("You are not authenticated.");
      setLoading(false);
    }
  }, [status, session, debouncedSearchTerm, canRead]); // Added canRead dependency

  const handleOpenCreateModal = () => { setToolToEdit(null); setIsToolFormModalOpen(true); };
  const handleOpenEditModal = (tool: ITool) => { setToolToEdit(tool); setIsToolFormModalOpen(true); };
  const handleCloseToolFormModal = () => { setIsToolFormModalOpen(false); setToolToEdit(null); };
  const handleOpenAdjustmentModal = (tool: ITool) => { setToolToAdjust(tool); setIsAdjustmentModalOpen(true); };
  const handleCloseAdjustmentModal = () => { setIsAdjustmentModalOpen(false); setToolToAdjust(null); };
  const handleSuccess = () => { fetchTools(); };
  const formatDate = (dateString?: string) => { if (!dateString) return 'N/A'; return new Date(dateString).toLocaleDateString(); };
  
  if (status === 'loading') {
    return <p className="p-8 text-center">Authenticating...</p>;
  }

  // ▼▼▼ TOP-LEVEL PERMISSION CHECK ▼▼▼
  if (!loading && !canRead) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-xl font-bold">Permission Denied</h2>
        <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }
  // ▲▲▲ END OF CHECK ▲▲▲

  return (
    <div className="p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b flex flex-row items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold">Tool Stock Management</h1>
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            {/* --- PERMISSION CHECK FOR IMPORT BUTTON --- */}
            {canUseReports && (
              <button onClick={() => setIsImportModalOpen(true)} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                <Upload className="mr-2 h-4 w-4" /> Import
              </button>
            )}
            {/* --- PERMISSION CHECK FOR AUDIT BUTTONS --- */}
            {canAudit && (
              <>
                <Link href="/tool-stock/audits" className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
                  <Archive className="mr-2 h-4 w-4" /> Audit History
                </Link>
                <Link href="/tool-stock/conduct-audit" className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600">
                  <FileCheck2 className="mr-2 h-4 w-4" /> Start New Audit
                </Link>
              </>
            )}
            {/* --- PERMISSION CHECK FOR ADD NEW TOOL BUTTON --- */}
            {canManage && (
              <button onClick={handleOpenCreateModal} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Tool
              </button>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t">
          <input
            type="text"
            placeholder="Search by tool name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="p-4">
          {loading && <p className="text-center py-4">Loading tools...</p>}
          {error && <p className="text-center py-4 text-red-500">Error: {error}</p>}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Tool Name</th>
                    <th scope="col" className="px-6 py-3">Category</th>
                    <th scope="col" className="px-6 py-3 text-right">Current Stock</th>
                    <th scope="col" className="px-6 py-3">Maintenance Due</th>
                    {/* --- HIDE ACTIONS COLUMN IF NO MANAGE PERMISSION --- */}
                    {canManage && <th scope="col" className="px-6 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {tools.length > 0 ? (
                    tools.map((tool) => (
                      <tr key={tool._id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{tool.name}</td>
                        <td className="px-6 py-4">{tool.category}</td>
                        <td className="px-6 py-4 text-right">{tool.currentStock}</td>
                        <td className="px-6 py-4">{formatDate(tool.maintenanceDueDate)}</td>
                        {/* --- PERMISSION CHECK FOR ACTION BUTTONS IN EACH ROW --- */}
                        {canManage && (
                          <td className="px-6 py-4 flex items-center space-x-4">
                            <button onClick={() => handleOpenEditModal(tool)} className="font-medium text-blue-600 hover:underline" title="Edit Tool Details"><Edit size={16} /></button>
                            <button onClick={() => handleOpenAdjustmentModal(tool)} className="font-medium text-green-600 hover:underline" title="Adjust Stock"><ListPlus size={16} /></button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                       {/* --- Adjust colspan based on whether actions column is visible --- */}
                      <td colSpan={canManage ? 5 : 4} className="px-6 py-4 text-center">
                        {debouncedSearchTerm ? `No tools found for "${debouncedSearchTerm}".` : "No tools found. Add your first tool to get started."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* --- The modals will now only open if the buttons that trigger them are visible --- */}
      {/* We can add an extra layer of security by checking permissions before rendering modals too */}
      {canManage && (
        <ToolFormModal isOpen={isToolFormModalOpen} onClose={handleCloseToolFormModal} onSuccess={handleSuccess} toolToEdit={toolToEdit} tenantId={session?.user?.tenantId} />
      )}
      {canManage && (
        <StockAdjustmentModal isOpen={isAdjustmentModalOpen} onClose={handleCloseAdjustmentModal} onSuccess={handleSuccess} tool={toolToAdjust} tenantId={session?.user?.tenantId} />
      )}
      {canManage && (
        <ToolImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onSuccess={handleSuccess} tenantId={session?.user?.tenantId} />
      )}
    </div>
  );
}