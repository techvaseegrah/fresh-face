'use client';
import React from 'react';
import { XMarkIcon, QrCodeIcon } from '@heroicons/react/24/solid';
import { CustomerDetails, AppointmentHistory } from './types';

// Utility function can be co-located or moved to a shared utils file
const getStatusColor = (status: string) => {
  switch (status) {
    case 'Appointment': return 'bg-blue-100 text-blue-800';
    case 'Checked-In': return 'bg-yellow-100 text-yellow-800';
    case 'Checked-Out': return 'bg-purple-100 text-purple-800';
    case 'Paid': return 'bg-green-100 text-green-800';
    case 'Cancelled': return 'bg-red-100 text-red-800';
    case 'No-Show': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerDetails | null;
}

const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({ isOpen, onClose, customer }) => {
  if (!isOpen || !customer) return null;
  const totalSpent = customer.appointmentHistory.filter(apt => apt.status === 'Paid').reduce((sum: number, apt: AppointmentHistory) => sum + apt.totalAmount, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-xl md:text-2xl font-bold">History - {customer.name}</h2>
          <button onClick={onClose}><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-center"><div className="text-2xl font-bold text-blue-600">{customer.appointmentHistory.length}</div><div className="text-sm text-gray-600">Total Visits</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-green-600">₹{totalSpent.toFixed(0)}</div><div className="text-sm text-gray-600">Total Spent</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-yellow-600">{customer.loyaltyPoints || 0}</div><div className="text-sm text-gray-600">Loyalty Points</div></div>
          <div className="text-center"><div className={`text-2xl font-bold ${customer.isMember ? 'text-green-600' : 'text-gray-400'}`}>{customer.isMember ? 'YES' : 'NO'}</div><div className="text-sm text-gray-600">Member</div></div>
        </div>
        {customer.membershipBarcode && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <QrCodeIcon className="w-6 h-6 text-blue-600" />
              <div>
                <div className="font-semibold text-blue-800">Membership Barcode</div>
                <div className="text-sm text-blue-600 font-mono">{customer.membershipBarcode}</div>
              </div>
            </div>
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold mb-4">Appointment History</h3>
          {customer.appointmentHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No appointment history found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Services & Invoice</th>
                    <th className="px-4 py-2 text-left">Stylist</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.appointmentHistory.map((apt: AppointmentHistory) => (
                    <tr key={apt._id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {new Date(apt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {apt.isImported && <span className="block text-xs text-gray-400 italic">Imported</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate font-medium" title={apt.services.join(', ')}>{apt.services.join(', ') || 'N/A'}</div>
                        {(apt.invoiceNumber && apt.invoiceNumber !== 'N/A') && (
                          <div className="mt-1 text-xs text-gray-500 space-x-2">
                            <span>Inv: <span className="font-medium text-gray-700">{apt.invoiceNumber}</span></span>
                            <span>|</span>
                            <span>Paid via: <span className="font-medium text-gray-700">{apt.paymentMode}</span></span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{apt.stylistName}</td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apt.status)}`}>{apt.status}</span></td>
                      <td className="px-4 py-3 text-right font-semibold">₹{apt.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerHistoryModal;