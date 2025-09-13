import React from 'react';
import Button from '@/components/ui/Button';
import { CheckCircle, XCircle, ShoppingCart } from 'lucide-react';

// ✨ --- MODIFICATION: The card component is updated to accept and display daily sales --- ✨
const IncentiveResultCard = ({ title, data, dailySaleValue }: { title: string; data: any; dailySaleValue?: number }) => {
    if (!data || Object.keys(data).length === 0) {
        return (
            <div className="bg-gray-100 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-gray-700">{title}</h3>
                <p className="text-sm text-gray-500 mt-2">No rule configured.</p>
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

            {/* ✅ ADDITION: This block displays the sales for today if the value is provided */}
            {dailySaleValue !== undefined && dailySaleValue > 0 && (
                 <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                        <span className="font-semibold text-indigo-600">Today's Sale:</span>
                        <span className="font-semibold text-indigo-600">{`₹${dailySaleValue.toFixed(2)}`}</span>
                    </div>
                 </div>
            )}

            <div className="mt-3 space-y-1">
                {Object.entries(data).map(([key, value]) => {
                    if (key === 'isTargetMet' || key === 'details') return null;
                    
                    let keyFormatted = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    
                    // ✅ ADDITION: Renames 'Total Sale Value' to be more specific for clarity
                    if ((title.includes('Package') || title.includes('Gift Card')) && key === 'totalSaleValue') {
                        keyFormatted = 'Total Sale Value (Month)';
                    }

                    let valueFormatted;
                    if (typeof value === 'number') {
                        valueFormatted = key.toLowerCase().includes('rate') 
                            ? (value as number).toFixed(2) 
                            : `₹${value.toFixed(2)}`;
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

// This component is UNCHANGED.
const DailyBreakdownCard = ({ data }: { data: any }) => {
    const dailyDetails = data?.incentive1_daily?.details;
    
    const renderRow = (label: string, saleValue: number, incentiveData?: any) => {
        const incentiveAmount = incentiveData?.incentiveAmount || 0;
        const appliedRate = incentiveData?.appliedRate || 0;
        const isTargetMet = incentiveData?.isTargetMet || false;

        return (
             <div className="p-2 rounded-md bg-white">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{label}:</span>
                    <span className="font-semibold text-gray-800">₹{saleValue.toFixed(2)}</span>
                </div>
                {isTargetMet && incentiveAmount > 0 && saleValue > 0 && (
                    <div className="flex justify-end items-center text-xs text-green-600 mt-1">
                        <span>Incentive: ₹{incentiveAmount.toFixed(2)}</span>
                        <span className="mx-1">|</span>
                        <span>Rate: {appliedRate.toFixed(2)}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 rounded-lg bg-slate-100 border border-slate-200 col-span-1 md:col-span-2">
             <div className="flex items-center mb-3">
                <ShoppingCart size={16} className="text-slate-600 mr-2" />
                <h3 className="font-bold text-lg text-slate-800">Sales & Incentive Breakdown</h3>
            </div>
             <div className="space-y-2">
                {dailyDetails ? (
                    <>
                        <h4 className="font-semibold text-xs text-gray-500 px-2 pt-2">DAILY SALES (FOR THIS DAY)</h4>
                        {renderRow("Service Sale", dailyDetails.serviceSale)}
                        {renderRow("Product Sale", dailyDetails.productSale)}
                        {renderRow("Review (Name) Bonus", dailyDetails.reviewNameBonus)}
                        {renderRow("Review (Photo) Bonus", dailyDetails.reviewPhotoBonus)}
                        <div className="mt-1 pt-1 border-t border-slate-300">
                             {renderRow("Daily Incentive Total", dailyDetails.serviceSale + dailyDetails.productSale + dailyDetails.reviewNameBonus + dailyDetails.reviewPhotoBonus, data.incentive1_daily)}
                        </div>
                        
                        <h4 className="font-semibold text-xs text-gray-500 px-2 pt-3">MONTHLY CUMULATIVE SALES</h4>
                        {renderRow("Package Sale", dailyDetails.packageSale, data.incentive3_package)}
                        {renderRow("Gift Card Sale", dailyDetails.giftCardSale, data.incentive4_giftCard)}
                        {renderRow("Monthly Sales (Service/Product)", data.incentive2_monthly?.totalSaleValue || 0, data.incentive2_monthly)}
                    </>
                ) : (
                    <p className="text-gray-500 col-span-full text-sm p-2">No sales were recorded for this day.</p>
                )}
            </div>
        </div>
    );
}

// ✨ --- MODIFICATION: The main modal now passes the daily sales data to the cards --- ✨
export default function IncentiveResultsModal({ data, onClose }: { data: any; onClose: () => void; }) {
    if (!data) return null;

    const totalIncentive = (data.incentive1_daily?.incentiveAmount || 0) + 
                           (data.incentive2_monthly?.incentiveAmount || 0) +
                           (data.incentive3_package?.incentiveAmount || 0) +
                           (data.incentive4_giftCard?.incentiveAmount || 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Results for {data.staffName} on {data.calculationDate}</h2>
                    <p className="text-4xl font-bold text-green-600 my-2">Total: ₹{totalIncentive.toFixed(2)}</p>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IncentiveResultCard title="Incentive 1: Daily" data={data.incentive1_daily} />
                        <IncentiveResultCard title="Incentive 2: Monthly" data={data.incentive2_monthly} />

                        {/* ✅ ADDITION: Pass the daily sale value from the daily details object */}
                        <IncentiveResultCard 
                            title="Incentive 3: Package" 
                            data={data.incentive3_package} 
                            dailySaleValue={data.incentive1_daily?.details?.packageSale} 
                        />
                        <IncentiveResultCard 
                            title="Incentive 4: Gift Card" 
                            data={data.incentive4_giftCard} 
                            dailySaleValue={data.incentive1_daily?.details?.giftCardSale} 
                        />

                        <DailyBreakdownCard data={data} />
                    </div>
                </div>

                <div className="flex justify-end p-4 border-t bg-slate-50 rounded-b-xl">
                    <Button onClick={onClose} variant="danger">Close</Button>
                </div>
            </div>
        </div>
    );
};