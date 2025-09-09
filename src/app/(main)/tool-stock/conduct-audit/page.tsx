'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Define the shape of a tool for our audit list
interface AuditTool {
  _id: string;
  name: string;
  category: string;
  expectedStock: number;
  countedStock: string; // Use string for input field, will parse to number on submit
  remarks: string;
}

export default function ConductAuditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [auditList, setAuditList] = useState<AuditTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect to fetch tools and handle session state changes
  useEffect(() => {
    // Case 1: Session is successfully loaded and we have a tenantId
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
          // Transform the tool data into the shape our audit form needs
          const initialAuditList: AuditTool[] = toolsData.map((tool: any) => ({
            _id: tool._id,
            name: tool.name,
            category: tool.category,
            expectedStock: tool.currentStock,
            countedStock: '', // Start with empty input
            remarks: '',
          }));
          setAuditList(initialAuditList);
        } catch (err: any) {
          setError(err.message);
        } finally {
          // This will run on success or failure of the fetch
          setLoading(false);
        }
      };
      fetchToolsForAudit();
    } 
    // Case 2: Session is still loading, so we wait
    else if (status === 'loading') {
      // Do nothing, the loading screen is already showing.
    }
    // Case 3: Session is unauthenticated or failed to load
    else {
      setError("You are not authenticated. Please log in.");
      setLoading(false); // Crucial: Turn off loading to show the error message.
    }
  }, [status, session]);

  // Handler to update the state when an auditor types in a count or remark
  const handleAuditItemChange = (toolId: string, field: 'countedStock' | 'remarks', value: string) => {
    setAuditList(prevList =>
      prevList.map(item =>
        item._id === toolId ? { ...item, [field]: value } : item
      )
    );
  };

  // Handler for submitting the entire audit form
  const handleSubmitAudit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user?.tenantId) {
        setError("Your session has expired. Please log in again.");
        return;
    }
    setSubmitting(true);
    setError(null);

    // Prepare the payload for the API
    const auditPayload = {
      items: auditList.map(item => ({
        toolId: item._id,
        toolName: item.name,
        expectedStock: item.expectedStock,
        // Default to 0 if input is empty, parse to number
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

      // Success! Redirect to the main tool stock page.
      router.push('/tool-stock');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Render a loading state until the initial data fetch is complete
  if (loading) {
    return <p className="p-8 text-center">Loading Audit Checklist...</p>;
  }

  return (
    <div className="p-4 md:p-8">
      <form onSubmit={handleSubmitAudit}>
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b flex flex-row items-center justify-between">
            <div className='flex items-center space-x-3'>
              <Link href="/tool-stock" className="p-2 rounded-full hover:bg-gray-100" title="Back to Tool List">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="text-xl font-bold">Conduct Tool Audit</h1>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
              disabled={submitting || auditList.length === 0}
            >
              {submitting ? 'Submitting...' : 'Submit Audit Report'}
            </button>
          </div>
          <div className="p-4">
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
            
            {auditList.length === 0 && !error && (
                <div className="text-center py-10">
                    <p className="text-gray-500">No tools found to audit.</p>
                    <p className="text-sm text-gray-400 mt-2">Please add tools from the main management page first.</p>
                </div>
            )}

            {auditList.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3">Tool Name</th>
                      <th scope="col" className="px-6 py-3 text-center">Expected Stock</th>
                      <th scope="col" className="px-6 py-3 text-center">Counted Stock</th>
                      <th scope="col" className="px-6 py-3 text-center">Status</th>
                      <th scope="col" className="px-6 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditList.map((item) => {
                      const counted = parseInt(item.countedStock, 10);
                      const isMismatched = !isNaN(counted) && item.countedStock !== '' && counted !== item.expectedStock;
                      const isMatched = !isNaN(counted) && item.countedStock !== '' && counted === item.expectedStock;
                      
                      return (
                        <tr key={item._id} className={`border-b ${isMismatched ? 'bg-red-50' : isMatched ? 'bg-green-50' : 'bg-white'}`}>
                          <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                          <td className="px-6 py-4 text-center font-bold">{item.expectedStock}</td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              min="0"
                              value={item.countedStock}
                              onChange={(e) => handleAuditItemChange(item._id, 'countedStock', e.target.value)}
                              className="w-24 mx-auto text-center px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-center font-medium">
                            {isMatched && <span className="text-green-600">Matched</span>}
                            {isMismatched && <span className="text-red-600">Missing: {item.expectedStock - counted}</span>}
                          </td>
                          <td className="px-6 py-4">
                            {isMismatched && (
                              <input
                                type="text"
                                value={item.remarks}
                                onChange={(e) => handleAuditItemChange(item._id, 'remarks', e.target.value)}
                                placeholder="Reason for mismatch (e.g., Damaged)"
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}