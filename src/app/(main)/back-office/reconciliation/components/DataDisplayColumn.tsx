import Card from '@/components/ui/Card';

type SoftwareData = {
  serviceTotal: number;
  productTotal: number;
  cash: number;
  gpay: number;
  card: number;
  sumup: number;
  total: number;
};

interface DataDisplayColumnProps {
  data: SoftwareData;
  openingBalance: number; 
}

const DataRow = ({ label, value, isBold = false, helpText }: { label: string; value: number; isBold?: boolean; helpText?: string }) => (
  <div className="flex justify-between py-1.5 text-sm">
    <div className="flex flex-col">
      <span className={`text-gray-600 ${isBold ? 'font-semibold' : ''}`}>{label}:</span>
      {helpText && <span className="text-xs text-gray-400 -mt-1">{helpText}</span>}
    </div>
    <span className={`font-semibold ${isBold ? 'text-gray-900' : 'text-gray-800'}`}>
      ₹{Number(value || 0).toLocaleString('en-IN')}
    </span>
  </div>
);

export const DataDisplayColumn = ({ data, openingBalance }: DataDisplayColumnProps) => {
  const totalCashToAccountFor = openingBalance + data.cash;

  return (
    <Card className="p-4 bg-blue-50/50 shadow-sm">
      <h2 className="text-lg font-bold mb-3 border-b border-blue-200 pb-2 text-blue-800">Data from Software</h2>
      <div className="space-y-1">

        {/* ======================= START: UI LABEL FIXES ======================= */}

        {/* Sales Section - Now clearly labeled */}
        <p className="text-xs text-blue-700 font-semibold pt-1">REVENUE FROM NEW PAYMENTS</p>
        <DataRow 
          label="Services (Cash/Card Sales)" 
          value={data.serviceTotal} 
          helpText="(Excludes Package/Gift Card Redemptions)"
        />
        <DataRow label="Product Sales" value={data.productTotal} />
        <hr className="my-2 border-blue-200" />

        {/* Cash Section - No label changes needed, logic is clear */}
        <DataRow label="Opening Cash Balance" value={openingBalance} isBold={true} />
        <DataRow label="Cash from Today's Sales" value={data.cash} />
        <div className="flex justify-between py-1.5 text-sm bg-blue-100 -mx-2 px-2 rounded">
          <span className="font-bold text-gray-700">Total Cash to Account For:</span>
          <span className="font-bold text-gray-900">
            ₹{totalCashToAccountFor.toLocaleString('en-IN')}
          </span>
        </div>
        <hr className="my-2 border-blue-200" />

        {/* Other Payment Methods Section - No changes needed */}
        <DataRow label="Gpay (UPI)" value={data.gpay} />
        <DataRow label="Card" value={data.card} />
        <DataRow label="SumUp" value={data.sumup} />
        <hr className="my-2 border-t-2 border-gray-300" />

        {/* Grand Total Section - Now clearly labeled */}
        <div className="flex justify-between py-1.5 text-base">
          <span className="font-bold text-gray-800">Total Collection:</span>
          <span className="font-bold text-lg text-blue-900">
            ₹{data.total.toLocaleString('en-IN')}
          </span>
        </div>

        {/* ======================== END: UI LABEL FIXES ======================== */}

      </div>
    </Card>
  );
};