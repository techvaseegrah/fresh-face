'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertTriangle, Clock, ClipboardList, Loader2 } from 'lucide-react';

// Define the shape of a tool for our audit list
interface AuditTool {
  _id: string;
  name: string;
  category: string;
  expectedStock: number;
  countedStock: string; // Use string for input field, will parse to number on submit
  remarks: string;
}

const StatusBadge = ({ item }: { item: AuditTool }) => {
  const countedValue = item.countedStock.trim();
  
  if (countedValue === '') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <Clock className="w-3 h-3 mr-1.5" />
        Pending
      </span>
    );
  }

  const counted = parseInt(countedValue, 10);
  const isMismatched = !isNaN(counted) && counted !== item.expectedStock;
  const isMatched = !isNaN(counted) && counted === item.expectedStock;

  if (isMatched) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1.5" />
        Matched
      </span>
    );
  }

  if (isMismatched) {
    const difference = item.expectedStock - counted;
    return (
       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <AlertTriangle className="w-3 h-3 mr-1.5" />
        {difference > 0 ? `Missing: ${difference}` : `Surplus: ${-difference}`}
      </span>
    );
  }

  return null; // Should not happen if logic is correct
};


export default function ConductAuditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [auditList, setAuditList] = useState<AuditTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.tenantId) {
      const fetchToolsForAudit = async () => {
        try {
          const response = await fetch('/api/tool-stock/tools', {
            headers: { 'x-tenant-id': session.user.tenantId! },
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch tools for audit.');
          }
          
          const toolsData = await response.json();
          const initialAuditList: AuditTool[] = toolsData.map((tool: any) => ({
            _id: tool._id,
            name: tool.name,
            category: tool.category,
            expectedStock: tool.currentStock,
            countedStock: '',
            remarks: '',
          }));
          setAuditList(initialAuditList);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchToolsForAudit();
    } 
    else if (status === 'loading') {
      // Wait for session
    }
    else {
      setError("You are not authenticated. Please log in.");
      setLoading(false);
    }
  }, [status, session]);

  const handleAuditItemChange = (toolId: string, field: 'countedStock' | 'remarks', value: string) => {
    setAuditList(prevList =>
      prevList.map(item =>
        item._id === toolId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSubmitAudit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user?.tenantId) {
        setError("Your session has expired. Please log in again.");
        return;
    }
    setSubmitting(true);
    setError(null);

    // ✅ NEW: Validation for remarks on mismatch
    const mismatchesWithoutRemarks = auditList.filter(item => {
        const countedValue = item.countedStock.trim();
        // A mismatch only exists if a number has been entered
        if (countedValue === '') return false;
        
        const counted = parseInt(countedValue, 10);
        const hasMismatch = !isNaN(counted) && counted !== item.expectedStock;
        
        return hasMismatch && item.remarks.trim() === '';
    });

    if (mismatchesWithoutRemarks.length > 0) {
        setError(`Please provide a remark for the following tool(s) with a stock mismatch: ${mismatchesWithoutRemarks.map(i => i.name).join(', ')}`);
        setSubmitting(false); // Stop submission
        return;
    }

    const auditPayload = {
      items: auditList.map(item => ({
        toolId: item._id,
        toolName: item.name,
        expectedStock: item.expectedStock,
        countedStock: parseInt(item.countedStock, 10) || 0,
        remarks: item.remarks,
      })),
    };

    try {
      const response = await fetch('/api/tool-stock/audits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': session.user.tenantId,
        },
        body: JSON.stringify(auditPayload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit audit.');
      }

      router.push('/tool-stock');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-4 text-lg text-gray-600">Loading Audit Checklist...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <form onSubmit={handleSubmitAudit}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Link href="/tool-stock" className="p-2 rounded-full hover:bg-gray-200 transition-colors" title="Back to Tool List">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Tool Stock Audit</h1>
              <p className="text-sm text-gray-500 mt-1">Count the physical stock for each tool and record any discrepancies.</p>
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 sm:mt-0 w-full sm:w-auto px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            disabled={submitting || auditList.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : 'Submit Audit Report'}
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg">
          <div className="p-4">
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">{error}</div>}
            
            {auditList.length === 0 && !error && (
                <div className="text-center py-16">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900">No tools to audit</h3>
                    <p className="mt-1 text-sm text-gray-500">Please add tools from the management page first.</p>
                </div>
            )}

            {auditList.length > 0 && (
              <div>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 min-w-[200px]">Tool Name</th>
                        <th scope="col" className="px-6 py-3 text-center">Expected</th>
                        <th scope="col" className="px-6 py-3 text-center">Counted</th>
                        <th scope="col" className="px-6 py-3 text-center">Status</th>
                        <th scope="col" className="px-6 py-3 min-w-[250px]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditList.map((item) => {
                        const countedValue = item.countedStock.trim();
                        const counted = parseInt(countedValue, 10);
                        const isMismatched = countedValue !== '' && !isNaN(counted) && counted !== item.expectedStock;
                        const isMatched = countedValue !== '' && !isNaN(counted) && counted === item.expectedStock;
                        const rowClass = isMismatched ? 'border-red-300' : isMatched ? 'border-green-300' : 'border-transparent';
                        
                        return (
                          <tr key={item._id} className={`border-b border-l-4 ${rowClass} transition-colors`}>
                            <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                            <td className="px-6 py-4 text-center font-bold text-gray-700">{item.expectedStock}</td>
                            {/* ✅ FIX 1: The parent TD is now a flex container for perfect centering */}
                            <td className="px-6 py-4 flex justify-center items-center">
                              <input
                                type="number"
                                min="0"
                                value={item.countedStock}
                                onChange={(e) => handleAuditItemChange(item._id, 'countedStock', e.target.value)}
                                className="w-24 text-center px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4 text-center"><StatusBadge item={item} /></td>
                            <td className="px-6 py-4">
                                <input
                                  type="text"
                                  value={item.remarks}
                                  onChange={(e) => handleAuditItemChange(item._id, 'remarks', e.target.value)}
                                  // ✅ FIX 2: Placeholder and required attribute are now conditional
                                  placeholder={isMismatched ? "Reason is required..." : "Optional notes..."}
                                  required={isMismatched}
                                  className={`w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${isMismatched ? 'focus:ring-red-500 border-red-300' : 'focus:ring-blue-500'}`}
                                />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {auditList.map(item => {
                        const countedValue = item.countedStock.trim();
                        const counted = parseInt(countedValue, 10);
                        const isMismatched = countedValue !== '' && !isNaN(counted) && counted !== item.expectedStock;
                        const isMatched = countedValue !== '' && !isNaN(counted) && counted === item.expectedStock;
                        const cardClass = isMismatched ? 'border-red-300' : isMatched ? 'border-green-300' : 'border-gray-200';

                    return (
                      <div key={item._id} className={`border ${cardClass} rounded-lg p-4 shadow-sm`}>
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-lg text-gray-800">{item.name}</h3>
                            <StatusBadge item={item} />
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-medium text-gray-500">Expected</label>
                                  <p className="text-2xl font-bold text-gray-700">{item.expectedStock}</p>
                              </div>
                              <div>
                                  <label htmlFor={`count-${item._id}`} className="block text-xs font-medium text-gray-500">Counted</label>
                                  <input
                                    id={`count-${item._id}`}
                                    type="number"
                                    min="0"
                                    value={item.countedStock}
                                    onChange={(e) => handleAuditItemChange(item._id, 'countedStock', e.target.value)}
                                    className="w-full text-lg mt-1 px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                              </div>
                          </div>

                          <div className="mt-4">
                              <label htmlFor={`remarks-${item._id}`} className="block text-xs font-medium text-gray-500">Remarks</label>
                              <input
                                  id={`remarks-${item._id}`}
                                  type="text"
                                  value={item.remarks}
                                  onChange={(e) => handleAuditItemChange(item._id, 'remarks', e.target.value)}
                                  // ✅ FIX 2 (Mobile): Placeholder and required attribute are now conditional
                                  placeholder={isMismatched ? "Reason is required..." : "Optional notes..."}
                                  required={isMismatched}
                                  className={`w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${isMismatched ? 'focus:ring-red-500 border-red-300' : 'focus:ring-blue-500'}`}
                                />
                          </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}