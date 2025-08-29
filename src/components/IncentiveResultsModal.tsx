import React from 'react';
import Button from '@/components/ui/Button';
import { CheckCircle, XCircle } from 'lucide-react';

const IncentiveResultCard = ({ title, data }: { title: string; data: any; }) => {
    if (!data || Object.keys(data).length === 0) {
        return (
            <div className="bg-gray-100 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-gray-700">{title}</h3>
                <p className="text-sm text-gray-500 mt-2">No data available for this day.</p>
            </div>
        );
    }
    const isTargetMet = data.isTargetMet;
    return (
        <div className={`p-4 rounded-lg shadow-md bg-white border-l-4 ${isTargetMet ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${isTargetMet ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                    {isTargetMet ? <CheckCircle size={14} className="mr-1" /> : <XCircle size={14} className="mr-1" />}
                    {isTargetMet ? 'Target Met' : 'Target Missed'}
                </span>
            </div>
            <div className="mt-3 space-y-1">
                {Object.entries(data).map(([key, value]) => {
                    if (key === 'isTargetMet') return null;
                    const keyFormatted = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    let valueFormatted;
                    if (typeof value === 'number') {
                        valueFormatted = key.toLowerCase().includes('rate') ? (value * 100).toFixed(0) + '%' : `₹${value.toFixed(2)}`;
                    } else {
                        valueFormatted = String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    }
                    return (
                        <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-500">{keyFormatted}:</span>
                            <span className="font-medium text-gray-800">{valueFormatted}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function IncentiveResultsModal({ data, onClose }: { data: any; onClose: () => void; }) {
    if (!data) return null;
    const totalIncentive = (data.incentive1_daily?.incentiveAmount || 0) + (data.incentive2_monthly?.incentiveAmount || 0);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800">Results for {data.staffName} on {data.calculationDate}</h2>
                    <p className="text-4xl font-bold text-green-600 my-4">Total: ₹{totalIncentive.toFixed(2)}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IncentiveResultCard title="Incentive 1: Daily" data={data.incentive1_daily} />
                        <IncentiveResultCard title="Incentive 2: Monthly" data={data.incentive2_monthly} />
                    </div>
                    <div className="flex justify-end pt-4 mt-4 border-t">
                        <Button onClick={onClose} variant="danger">Close</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};