// app/DayendClosing/history/components/ReportListItem.tsx

import { ChevronDownIcon } from '@heroicons/react/24/solid';
import NetDiscrepancyBadge from '@/app/DayendClosing/history/components/NetDiscrepancyBadge';
import { DayEndClosingReport } from '@/lib/types'; // Assuming you have types defined

// It's good practice to define the props interface/type
interface ReportListItemProps {
  report: DayEndClosingReport;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function ReportListItem({ report, isExpanded, onToggle }: ReportListItemProps) {
  const reportDate = new Date(report.closingDate);

  // Formatting options for the date display
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  const formattedDate = reportDate.toLocaleDateString('en-US', dateOptions);

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden transition-all duration-300">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        {/* Date and Status */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{formattedDate}</p>
          <p className="text-xs text-gray-500 mt-1">
            Status: <span className="font-medium">Closed</span>
          </p>
        </div>

        {/* Discrepancy Badge and Chevron */}
        <div className="flex items-center gap-4 sm:gap-6 ml-4">
          
          {/* 
            ===========================================================
            THE FIX IS HERE: Added optional chaining (?.)
            This prevents a crash if report.discrepancy is undefined.
            ===========================================================
          */}
          <NetDiscrepancyBadge value={report.discrepancy?.total} />

          <ChevronDownIcon
            className={`h-6 w-6 text-gray-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Expanded Details View */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 bg-gray-50">
          <div className="py-4">
            <h4 className="text-sm font-semibold text-gray-600 mb-2">Report Details</h4>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>
                <strong>Total Sales:</strong> ${report.totalSales.toFixed(2)}
              </li>
              <li>
                <strong>Total Cash:</strong> ${report.totalCash.toFixed(2)}
              </li>
              {/* Add more details as needed */}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}