// src/app/staffmanagement/advance/Page.tsx

'use client';
import React, { useState } from 'react';
import { Wallet, Plus, Check, X, Calendar, DollarSign } from 'lucide-react';
import { useStaff, StaffMember, AdvancePaymentType } from '../../../../context/StaffContext';
import { format, parseISO } from 'date-fns';

const AdvancePayment: React.FC = () => {
  const {
    staffMembers,
    advancePayments,
    loadingAdvancePayments,
    errorAdvancePayments,
    requestAdvance,
    updateAdvanceStatus,
  } = useStaff();

  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [formData, setFormData] = useState({
    staffId: '',
    amount: 0,
    reason: '',
    repaymentPlan: 'One-time deduction',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSubmitError(null);
    setFormData({
      ...formData,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    });
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffId || formData.amount <= 0 || !formData.reason.trim()) {
      setSubmitError('Please fill all required fields: Staff Member, Amount, and Reason.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await requestAdvance({
        staffId: formData.staffId,
        amount: formData.amount,
        reason: formData.reason,
        repaymentPlan: formData.repaymentPlan,
      });
      setShowNewRequestForm(false);
      setFormData({ staffId: '', amount: 0, reason: '', repaymentPlan: 'One-time deduction' });
    } catch (error) {
      console.error('Failed to submit advance request:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'An unexpected error occurred.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateAdvanceStatus(id, 'approved');
    } catch (error) {
      console.error('Failed to approve advance:', error);
      alert(`Failed to approve: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateAdvanceStatus(id, 'rejected');
    } catch (error) {
      console.error('Failed to reject advance:', error);
      alert(`Failed to reject: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loadingAdvancePayments) {
    return <div className="p-8 text-center text-lg">Loading...</div>;
  }

  if (errorAdvancePayments) {
    return <div className="p-8 text-center text-red-500">{errorAdvancePayments}</div>;
  }

  const pendingPayments = advancePayments.filter((p) => p.status === 'pending');
  const historyPayments = advancePayments
    .filter((p) => p.status !== 'pending')
    .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-700">Advance Payment</h1>
        <button
          onClick={() => setShowNewRequestForm(!showNewRequestForm)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg shadow-md hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-opacity-75 transition-colors"
        >
          <Plus size={20} />
          New Advance Request
        </button>
      </div>

      {showNewRequestForm && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">New Advance Request Form</h2>
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            {submitError && (
              <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{submitError}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="staffId" className="block text-sm font-medium text-gray-600 mb-1">Staff Member*</label>
                <select id="staffId" name="staffId" required value={formData.staffId} onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-800 text-gray-900">
                  <option value="">Select Staff</option>
                  {staffMembers.filter(s => s.status === 'active').map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.name} - {staff.position}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-600 mb-1">Amount (₹)*</label>
                <input id="amount" name="amount" type="number" required min="1" step="0.01" value={formData.amount <= 0 ? '' : formData.amount} onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-800 text-gray-900"/>
              </div>
              <div className="md:col-span-2">
                 <label htmlFor="reason" className="block text-sm font-medium text-gray-600 mb-1">Reason for Advance*</label>
                 <textarea id="reason" name="reason" rows={3} required value={formData.reason} onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-800 text-gray-900 placeholder:text-gray-400"
                  placeholder="e.g., Medical emergency, family event..."/>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => setShowNewRequestForm(false)} disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancel</button>
              <button type="submit" disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-black disabled:bg-gray-400">
                <Wallet size={16} />
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Requests Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
        <h3 className="text-xl font-semibold text-gray-700 p-5">Pending Requests</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingPayments.map((payment) => {
                const staff = typeof payment.staffId === 'object' ? payment.staffId : staffMembers.find(s => s.id === payment.staffId);
                return (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-10 w-10 rounded-full object-cover" src={staff?.image || '/img/default-avatar.png'} alt={staff?.name} />
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{staff?.name}</div>
                          <div className="text-sm text-gray-500">{staff?.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{format(parseISO(payment.requestDate), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₹{payment.amount.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-xs">{payment.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleApprove(payment.id)} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Approve</button>
                        <button onClick={() => handleReject(payment.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">Reject</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pendingPayments.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-500">No pending requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advance History Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <h3 className="text-xl font-semibold text-gray-700 p-5">Advance Payment History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processed Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {historyPayments.map((payment) => {
                const staff = typeof payment.staffId === 'object' ? payment.staffId : staffMembers.find(s => s.id === payment.staffId);
                return (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-10 w-10 rounded-full object-cover" src={staff?.image || '/img/default-avatar.png'} alt={staff?.name} />
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{staff?.name}</div>
                          <div className="text-sm text-gray-500">{staff?.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₹{payment.amount.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{format(parseISO(payment.requestDate), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${payment.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{payment.approvedDate ? format(parseISO(payment.approvedDate), 'dd/MM/yyyy') : 'N/A'}</td>
                  </tr>
                );
              })}
              {historyPayments.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-500">No advance payment history available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdvancePayment;