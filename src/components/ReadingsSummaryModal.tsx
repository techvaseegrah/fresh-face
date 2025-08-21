'use client';

import { FC, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { CurrencyRupeeIcon, BoltIcon, CalendarDaysIcon, ChartBarIcon } from '@heroicons/react/24/outline';

// --- TYPE DEFINITIONS ---
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
}

// --- MAIN COMPONENT ---
const ReadingsSummaryModal: FC<ReadingsSummaryModalProps> = ({ isOpen, onClose, readings }) => {
  const summary = useMemo(() => {
    if (!readings || readings.length === 0) {
      return {
        meter1Units: 0,
        meter1Cost: 0,
        meter2Units: 0,
        meter2Cost: 0,
        totalAppointments: 0,
        avgCostPerUnit: 0,
        dailyBreakdown: [],
      };
    }

    // மீட்டர் வாரியாக யூனிட்கள் மற்றும் செலவைப் பிரிக்கிறோம்
    const meterTotals = readings.reduce((acc, r) => {
        const units = r.unitsConsumed || 0;
        const cost = r.totalCost || 0;

        if (r.meterIdentifier === 'meter-2') {
            acc.meter2Units += units;
            acc.meter2Cost += cost;
        } else { // meter-1 அல்லது meterIdentifier இல்லாதவை
            acc.meter1Units += units;
            acc.meter1Cost += cost;
        }
        return acc;
    }, { meter1Units: 0, meter1Cost: 0, meter2Units: 0, meter2Cost: 0 });


    // மற்ற மொத்த கணக்கீடுகள்
    const totalUnitsConsumed = meterTotals.meter1Units + meterTotals.meter2Units;
    const totalCost = meterTotals.meter1Cost + meterTotals.meter2Cost;
    const totalAppointments = readings.reduce((acc, r) => acc + (r.appointmentCount || 0), 0);
    const avgCostPerUnit = totalUnitsConsumed > 0 ? totalCost / totalUnitsConsumed : 0;

    const dailyBreakdown = [...readings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      ...meterTotals,
      totalAppointments,
      avgCostPerUnit,
      dailyBreakdown,
    };
  }, [readings]);

  if (!isOpen) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 transition-opacity duration-300" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto transition-transform duration-300 transform scale-95 animate-zoom-in" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm p-6 border-b border-slate-200 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-slate-800">Overall Summary</h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* === மாற்றப்பட்ட Summary Cards === */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* EB Meter 01 Summary Card */}
            <div className="bg-green-50 border border-green-200/50 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-green-900 text-center text-md">EB Meter 01</h3>
                <div className="flex justify-around items-center divide-x divide-green-200">
                    <div className="text-center px-2 flex-1">
                        <BoltIcon className="h-6 w-6 text-green-500 mx-auto mb-1" />
                        <p className="text-xs text-green-800">Total Units</p>
                        <p className="text-xl font-bold text-green-900">{summary.meter1Units.toFixed(2)}</p>
                    </div>
                    <div className="text-center px-2 flex-1">
                        <CurrencyRupeeIcon className="h-6 w-6 text-green-500 mx-auto mb-1" />
                        <p className="text-xs text-green-800">Total Cost</p>
                        <p className="text-xl font-bold text-green-900">{formatCurrency(summary.meter1Cost)}</p>
                    </div>
                </div>
            </div>

            {/* EB Meter 02 Summary Card */}
            <div className="bg-blue-50 border border-blue-200/50 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-blue-900 text-center text-md">EB Meter 02</h3>
                <div className="flex justify-around items-center divide-x divide-blue-200">
                    <div className="text-center px-2 flex-1">
                        <BoltIcon className="h-6 w-6 text-blue-500 mx-auto mb-1" />
                        <p className="text-xs text-blue-800">Total Units</p>
                        <p className="text-xl font-bold text-blue-900">{summary.meter2Units.toFixed(2)}</p>
                    </div>
                    <div className="text-center px-2 flex-1">
                        <CurrencyRupeeIcon className="h-6 w-6 text-blue-500 mx-auto mb-1" />
                        <p className="text-xs text-blue-800">Total Cost</p>
                        <p className="text-xl font-bold text-blue-900">{formatCurrency(summary.meter2Cost)}</p>
                    </div>
                </div>
            </div>

            {/* மற்ற Cards */}
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
          
          {/* Daily Breakdown Table - இது ஏற்கெனவே சரியாக உள்ளது */}
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
                  {summary.dailyBreakdown.map((reading) => (
                    <tr key={reading._id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-800 font-medium">
                        {new Date(reading.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ reading.meterIdentifier === 'meter-2' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800' }`}>
                            {reading.meterIdentifier === 'meter-2' ? 'EB Meter 02' : 'EB Meter 01'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                        {reading.unitsConsumed !== undefined ? reading.unitsConsumed.toFixed(2) : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                        {reading.costPerUnit !== undefined ? formatCurrency(reading.costPerUnit) : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                        {reading.totalCost !== undefined ? formatCurrency(reading.totalCost) : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                        {reading.appointmentCount !== undefined ? reading.appointmentCount : 'N/A'}
                      </td>
                    </tr>
                  ))}
                  {summary.dailyBreakdown.length === 0 && (
                     <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500">No data available.</td>
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