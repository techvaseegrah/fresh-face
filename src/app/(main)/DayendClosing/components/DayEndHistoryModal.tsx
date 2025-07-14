'use client';

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { DayEndReportHistoryItem } from '../history/hooks/useReportHistory';

interface DayEndHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: DayEndReportHistoryItem[];
}

export default function DayEndHistoryModal({ isOpen, onClose, reports }: DayEndHistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 transition-opacity" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transition-transform duration-300 scale-95 animate-zoom-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Day-End Closing History</h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"><XMarkIcon className="h-6 w-6"/></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {reports.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No day-end closing history found for the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Closing Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Expected Total</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actual Total</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Discrepancy</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Closed By</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {reports.map((report) => (
                    <tr key={report._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{new Date(report.closingDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{report.expected.total}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{report.actual.totalCountedCash + report.actual.card + report.actual.upi}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{report.discrepancy.total}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{report.closedBy.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{report.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg flex justify-end">
          <button type="button" className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
