'use client';

import { format } from 'date-fns';
import Button from '@/components/ui/Button'; // Assuming a generic Button component

interface FilterProps {
  filters: {
    startDate: Date;
    endDate: Date;
    outcome: string;
  };
  onFiltersChange: (newFilters: any) => void;
}

const OUTCOME_OPTIONS = [
  "All", "Appointment Booked", "Not Interested", "Specific Date",
  "Complaint", "Switched Off", "Number Busy", "No Reminder Call", "Will Come Later"
];

export default function ReportFilters({ filters, onFiltersChange }: FilterProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFiltersChange((prevFilters: any) => ({
      ...prevFilters,
      [name]: name.includes('Date') ? new Date(value) : value,
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
        <input type="date" name="startDate" id="startDate" value={format(filters.startDate, 'yyyy-MM-dd')} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
      </div>
      <div>
        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
        <input type="date" name="endDate" id="endDate" value={format(filters.endDate, 'yyyy-MM-dd')} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
      </div>
      <div>
        <label htmlFor="outcome" className="block text-sm font-medium text-gray-700">Response Type</label>
        <select name="outcome" id="outcome" value={filters.outcome} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
          {OUTCOME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    </div>
  );
}