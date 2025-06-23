// FILE: /app/DayendClosing/history/components/ReportDetailView.tsx
'use client';
import { DayEndReportHistoryItem } from '../hooks/useReportHistory';

// [THE FIX] A single, consistent helper component for displaying discrepancy values.
const Discrepancy = ({ value }: { value: number }) => {
  if (value === 0) return <div className="font-semibold text-green-600">₹0.00</div>;
  const isShort = value < 0;
  const color = isShort ? 'text-red-600' : 'text-yellow-600';
  const sign = isShort ? '-' : '+';
  return <div className={`font-semibold ${color}`}>{sign}₹{Math.abs(value).toFixed(2)}</div>;
};

export const ReportDetailView = ({ report }: { report: DayEndReportHistoryItem }) => {
  const totalActual = report.actual.totalCountedCash + report.actual.card + report.actual.upi;

  return (
    <div className="bg-gray-50/70 p-4 md:p-6 mt-2 border-t text-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
        <div className="space-y-2">
            <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Cash Reconciliation</h4>
            <div className="flex justify-between"><span>System Expected:</span> <span>₹{report.expected.cash.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Physically Counted:</span> <span>₹{report.actual.totalCountedCash.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-2 mt-1"><span className="text-gray-600">Discrepancy:</span> <Discrepancy value={report.discrepancy.cash} /></div>
        </div>
        <div className="space-y-2">
            <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Digital Payments</h4>
            <div className="flex justify-between"><span>Card (Expected):</span> <span>₹{report.expected.card.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Card (Actual):</span> <span>₹{report.actual.card.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-2 mt-1"><span className="text-gray-600">Card ±:</span> <Discrepancy value={report.discrepancy.card} /></div>
            <div className="flex justify-between pt-3 mt-2 border-t"><span>UPI (Expected):</span> <span>₹{report.expected.upi.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>UPI (Actual):</span> <span>₹{report.actual.upi.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-2 mt-1"><span className="text-gray-600">UPI ±:</span> <Discrepancy value={report.discrepancy.upi} /></div>
        </div>
        <div className="space-y-2">
            <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Overall Summary</h4>
            <div className="flex justify-between"><span>Total Expected:</span> <span>₹{report.expected.total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Total Actual:</span> <span>₹{totalActual.toFixed(2)}</span></div>
            <div className="flex justify-between text-base border-t pt-2 mt-1"><span className="text-gray-600">Net Discrepancy:</span> <Discrepancy value={report.discrepancy.total} /></div>
            {report.notes && (
                <div className="pt-3 mt-3 border-t"><h5 className="font-semibold text-xs text-gray-500 uppercase">Notes from Manager:</h5><p className="italic text-gray-700 bg-yellow-50/50 p-2 rounded mt-1">{report.notes}</p></div>
            )}
        </div>
      </div>
    </div>
  );
};