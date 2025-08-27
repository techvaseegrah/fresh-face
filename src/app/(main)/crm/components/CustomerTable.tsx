// FILE: /app/crm/components/CustomerTable.tsx
// NOTE: This component is now fully mobile-responsive using a robust card-based layout for mobile.

'use client';

import React from 'react';
import { CrmCustomer, PaginationInfo } from '../types';
import {
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';

// Helper function for Customer Activity Status
const getCustomerStatusColor = (status?: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'New': return 'bg-indigo-100 text-indigo-800';
      case 'Inactive': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-800';
    }
};

// Helper function to format dates nicely
const formatDate = (dateString?: string | Date) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(); 
};

interface CustomerTableProps {
  customers: CrmCustomer[];
  pagination: PaginationInfo;
  onViewDetails: (customer: CrmCustomer) => void;
  onEdit?: (customer: CrmCustomer) => void;
  onDelete?: (customerId: string, customerName: string) => void;
  onGoToPage: (page: number) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  pagination,
  onViewDetails,
  onEdit,
  onDelete,
  onGoToPage,
}) => {
  return (
    <div>
      <div className="md:bg-white md:rounded-lg md:shadow-sm md:border">
        {/* On mobile, we render a list of cards. On desktop, a table. */}
        <table className="w-full text-sm">
          <thead className="hidden md:table-header-group bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 text-left font-semibold">Name</th>
              <th className="px-6 py-4 text-left font-semibold">Activity Status</th>
              <th className="px-6 py-4 text-left font-semibold">Last Visit</th>
              <th className="px-6 py-4 text-left font-semibold">Last Services</th>
              <th className="px-6 py-4 text-center font-semibold">Membership</th>
              <th className="px-6 py-4 text-center font-semibold">Loyalty Points</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {customers.map((customer) => {
              const latestAppointment = customer.appointmentHistory?.[0];
              const lastVisitDate = latestAppointment?.date;
              const lastServices = latestAppointment?.services?.join(', ');

              return (
                <tr key={customer._id} className="block md:table-row mb-4 md:mb-0 md:border-b">
                  {/* --- MOBILE CARD VIEW --- */}
                  <td colSpan={7} className="block md:hidden p-0">
                    <div className="bg-white rounded-lg shadow-md border">
                        <div className="p-4 cursor-pointer" onClick={() => onViewDetails(customer)}>
                            {/* Card Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-gray-900 text-base">{customer.name}</div>
                                    <div className="text-xs text-gray-500 mt-1">{customer.email ?? 'No Email'}</div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCustomerStatusColor(customer.status)}`}>
                                    {customer.status ?? 'Unknown'}
                                </span>
                            </div>
                            {/* Card Body */}
                            <div className="mt-4 pt-4 border-t space-y-2 text-xs">
                                <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">Last Visit</span><span className="text-gray-800 font-semibold">{formatDate(lastVisitDate)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">Membership</span>
                                  {customer.isMembership ? <span className="inline-flex items-center gap-1.5 font-semibold text-yellow-700"><SparklesIcon className="w-4 h-4 text-yellow-500" />YES</span> : <span className="text-gray-500">No</span>}
                                </div>
                                <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">Loyalty Points</span><span className="font-bold text-base text-indigo-600">{customer.loyaltyPoints ?? 0}</span></div>
                            </div>
                        </div>
                        {/* Card Footer Actions */}
                        {(onEdit || onDelete) && (
                            <div className="border-t p-2 flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                                {onEdit && <button onClick={() => onEdit(customer)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full" title="Edit Customer"><PencilIcon className="w-4 h-4" /></button>}
                                {onDelete && <button onClick={() => onDelete(customer._id, customer.name)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full" title="Deactivate Customer"><TrashIcon className="w-4 h-4" /></button>}
                            </div>
                        )}
                    </div>
                  </td>

                  {/* --- DESKTOP TABLE VIEW (Hidden on mobile) --- */}
                  <td className="hidden md:table-cell px-6 py-4 cursor-pointer" onClick={() => onViewDetails(customer)}>
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-xs text-gray-500">{customer.email ?? 'No Email'}</div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 cursor-pointer" onClick={() => onViewDetails(customer)}>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCustomerStatusColor(customer.status)}`}>{customer.status ?? 'Unknown'}</span>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-700 cursor-pointer" onClick={() => onViewDetails(customer)}>{formatDate(lastVisitDate)}</td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-700 truncate max-w-xs cursor-pointer" title={lastServices} onClick={() => onViewDetails(customer)}>{lastServices ?? 'N/A'}</td>
                  <td className="hidden md:table-cell px-6 py-4 text-center cursor-pointer" onClick={() => onViewDetails(customer)}>
                    {customer.isMembership ? <span className="inline-flex items-center gap-1.5 font-semibold text-yellow-700"><SparklesIcon className="w-4 h-4 text-yellow-500" />YES</span> : <span className="text-gray-500">No</span>}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-center font-bold text-lg text-indigo-600 cursor-pointer" onClick={() => onViewDetails(customer)}>{customer.loyaltyPoints ?? 0}</td>
                  <td className="hidden md:table-cell px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end space-x-1">
                      {onEdit && <button onClick={() => onEdit(customer)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full" title="Edit Customer"><PencilIcon className="w-4 h-4" /></button>}
                      {onDelete && <button onClick={() => onDelete(customer._id, customer.name)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full" title="Deactivate Customer"><TrashIcon className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
         <div className="px-4 py-4 md:border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600 bg-white md:bg-transparent rounded-b-lg">
            <div className="text-center sm:text-left">
                Showing{' '}
                <span className="font-semibold">{(pagination.currentPage - 1) * 10 + 1}</span>
                {' '}to{' '}
                <span className="font-semibold">{Math.min(pagination.currentPage * 10, pagination.totalCustomers)}</span>
                {' '}of{' '}
                <span className="font-semibold">{pagination.totalCustomers}</span>
                {' '}results
            </div>
            <div className="flex items-center space-x-2">
                <button onClick={() => onGoToPage(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1} className="px-3 py-1 border rounded-md disabled:opacity-50 flex items-center hover:bg-gray-50">
                    <ChevronLeftIcon className="h-4 w-4 mr-1" /> Previous
                </button>
                <span className="px-2">
                    Page <span className="font-semibold">{pagination.currentPage}</span> of <span className="font-semibold">{pagination.totalPages}</span>
                </span>
                <button onClick={() => onGoToPage(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.totalPages} className="px-3 py-1 border rounded-md disabled:opacity-50 flex items-center hover:bg-gray-50">
                    Next <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
            </div>
         </div>
      )}
    </div>
  );
};