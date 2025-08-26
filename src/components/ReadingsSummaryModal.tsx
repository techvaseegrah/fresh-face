'use client';

import { FC, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { CurrencyRupeeIcon, BoltIcon, CalendarDaysIcon, ChartBarIcon } from '@heroicons/react/24/outline';

// --- TYPE DEFINITIONS ---
interface EBMeter {
  identifier: string;
  name: string;
}

interface IEBReading {
  _id: string;
  date: string;
  meterIdentifier: string;
  morningUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
}

interface IEBReadingWithAppointments extends IEBReading {
  appointmentCount?: number;
}

interface ReadingsSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  readings: IEBReadingWithAppointments[];
  meters: EBMeter[];
}

// --- MAIN COMPONENT ---
const ReadingsSummaryModal: FC<ReadingsSummaryModalProps> = ({ isOpen, onClose, readings, meters }) => {

  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const summary = useMemo(() => {
    // Filter readings based on the selected date range first
    const filteredReadings = readings.filter(reading => {
      const readingDate = new Date(reading.date);
      if (startDate && readingDate < new Date(startDate)) {
        return false;
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (readingDate > endOfDay) {
          return false;
        }
      }
      return true;
    });

    if (filteredReadings.length === 0 || !meters || meters.length === 0) {
      return {
        meterBreakdown: [],
        totalAppointments: 0,
        avgCostPerUnit: 0,
        dailyBreakdown: [],
      };
    }

    const meterBreakdown = meters.map(meter => ({
      identifier: meter.identifier,
      name: meter.name,
      totalUnits: 0,
      totalCost: 0,
    }));
    
    const meterMap = new Map(meterBreakdown.map(m => [m.identifier, m]));

    // This Map will store the appointment count for each day only ONCE to prevent double-counting.
    const dailyAppointments = new Map<string, number>();

    // Use the filtered list for all calculations
    for (const reading of filteredReadings) {
      // Aggregate meter-specific data
      const meterData = meterMap.get(reading.meterIdentifier);
      if (meterData) {
        meterData.totalUnits += reading.unitsConsumed || 0;
        meterData.totalCost += reading.totalCost || 0;
      }

      // De-duplicate appointment counts by using the date as a unique key
      const dateKey = new Date(reading.date).toISOString().split('T')[0];
      if (!dailyAppointments.has(dateKey)) {
        dailyAppointments.set(dateKey, reading.appointmentCount || 0);
      }
    }

    // Sum the unique daily appointment counts
    const totalAppointments = Array.from(dailyAppointments.values()).reduce((sum, count) => sum + count, 0);

    const totalUnitsConsumed = meterBreakdown.reduce((sum, meter) => sum + meter.totalUnits, 0);
    const totalCost = meterBreakdown.reduce((sum, meter) => sum + meter.totalCost, 0);
    const avgCostPerUnit = totalUnitsConsumed > 0 ? totalCost / totalUnitsConsumed : 0;
    
    const dailyBreakdown = [...filteredReadings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      meterBreakdown,
      totalAppointments, // This is now the corrected, de-duplicated total
      avgCostPerUnit,
      dailyBreakdown,
    };
  }, [readings, meters, startDate, endDate]);

  if (!isOpen) {
    return null;
  }
  
  const handleResetFilter = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const cardColorClasses = [
    { bg: 'bg-green-50', border: 'border-green-200/50', text: 'text-green-900', icon: 'text-green-500', divide: 'divide-green-200' },
    { bg: 'bg-blue-50', border: 'border-blue-200/50', text: 'text-blue-900', icon: 'text-blue-500', divide: 'divide-blue-200' },
    { bg: 'bg-purple-50', border: 'border-purple-200/50', text: 'text-purple-900', icon: 'text-purple-500', divide: 'divide-purple-200' },
    { bg: 'bg-orange-50', border: 'border-orange-200/50', text: 'text-orange-900', icon: 'text-orange-500', divide: 'divide-orange-200' },
  ];
  const badgeColorClasses = [
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 transition-opacity duration-300" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col transition-transform duration-300 transform scale-95 animate-zoom-in" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm p-6 border-b border-slate-200 flex justify-between items-center z-10 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Overall Summary</h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
          {/* Date Filter UI Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-3">Filter by Date Range</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="lg:col-span-2">
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-600">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate || ''}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div className="lg:col-span-2">
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-600">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate || ''}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <button
                onClick={handleResetFilter}
                className="w-full text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
          <hr className="border-slate-200" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {summary.meterBreakdown.map((meter, index) => {
                const colors = cardColorClasses[index % cardColorClasses.length];
                return (
                    <div key={meter.identifier} className={`${colors.bg} ${colors.border} rounded-xl p-4 space-y-3`}>
                        <h3 className={`font-bold ${colors.text} text-center text-md`}>{meter.name}</h3>
                        <div className={`flex justify-around items-center divide-x ${colors.divide}`}>
                            <div className="text-center px-2 flex-1">
                                <BoltIcon className={`h-6 w-6 ${colors.icon} mx-auto mb-1`} />
                                <p className={`text-xs ${colors.text} opacity-80`}>Total Units</p>
                                <p className={`text-xl font-bold ${colors.text}`}>{meter.totalUnits.toFixed(2)}</p>
                            </div>
                            <div className="text-center px-2 flex-1">
                                <CurrencyRupeeIcon className={`h-6 w-6 ${colors.icon} mx-auto mb-1`} />
                                <p className={`text-xs ${colors.text} opacity-80`}>Total Cost</p>
                                <p className={`text-xl font-bold ${colors.text}`}>{formatCurrency(meter.totalCost)}</p>
                            </div>
                        </div>
                    </div>
                );
            })}

            <div className="bg-sky-50 border border-sky-200/50 rounded-xl p-4 text-center">
              <CalendarDaysIcon className="h-7 w-7 text-sky-500 mx-auto mb-2" />
              <p className="text-sm text-sky-800">Total Appointments</p>
              <p className="text-2xl font-bold text-sky-900">{summary.totalAppointments}</p>
            </div>
            <div className="bg-violet-50 border border-violet-200/50 rounded-xl p-4 text-center">
              <ChartBarIcon className="h-7 w-7 text-violet-500 mx-auto mb-2" />
              <p className="text-sm text-violet-800">Avg. Cost Per Unit</p>
              <p className="text-2xl font-bold text-violet-900">{formatCurrency(summary.avgCostPerUnit)}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4">Daily Breakdown</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Meter</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Units Used</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost / Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Appointments</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {summary.dailyBreakdown.map((reading) => {
                    const meter = meters.find(m => m.identifier === reading.meterIdentifier);
                    const meterName = meter?.name || 'Unknown';
                    const meterIndex = meters.findIndex(m => m.identifier === reading.meterIdentifier);
                    const badgeColor = meterIndex !== -1 ? badgeColorClasses[meterIndex % badgeColorClasses.length] : 'bg-gray-100 text-gray-800';
                    
                    return (
                        <tr key={reading._id} className="hover:bg-slate-50">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-800 font-medium">
                            {new Date(reading.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                                {meterName}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{reading.unitsConsumed?.toFixed(2) ?? 'N/A'}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{reading.costPerUnit ? formatCurrency(reading.costPerUnit) : 'N/A'}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{reading.totalCost ? formatCurrency(reading.totalCost) : 'N/A'}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{reading.appointmentCount ?? 'N/A'}</td>
                        </tr>
                    );
                  })}
                  {summary.dailyBreakdown.length === 0 && (
                     <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500">No data found for the selected period.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadingsSummaryModal;