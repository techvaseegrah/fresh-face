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

// --- UPDATED PROPS: Added openingBalance ---
interface DataDisplayColumnProps {
  data: SoftwareData;
  openingBalance: number; // The cash carried over from the previous day
}

const DataRow = ({ label, value, isBold = false }: { label: string; value: number; isBold?: boolean }) => (
  <div className="flex justify-between py-1.5 text-sm">
    <span className={`text-gray-600 ${isBold ? 'font-semibold' : ''}`}>{label}:</span>
    <span className={`font-semibold ${isBold ? 'text-gray-900' : 'text-gray-800'}`}>
      ₹{value.toLocaleString('en-IN')}
    </span>
  </div>
);

export const DataDisplayColumn = ({ data, openingBalance }: DataDisplayColumnProps) => {
  // Calculate the total cash to be accounted for
  const totalCashToAccountFor = openingBalance + data.cash;

  return (
    <Card className="p-4 bg-blue-50/50 shadow-sm">
      <h2 className="text-lg font-bold mb-3 border-b border-blue-200 pb-2 text-blue-800">Data from Software</h2>
      <div className="space-y-1">
        {/* Sales Section */}
        <DataRow label="Service Sales" value={data.serviceTotal} />
        <DataRow label="Product Sales" value={data.productTotal} />
        <hr className="my-2 border-blue-200" />

        {/* --- UPDATED: Cash Section with Opening Balance --- */}
        <DataRow label="Opening Cash Balance" value={openingBalance} isBold={true} />
        <DataRow label="Cash from Sales" value={data.cash} />
        <div className="flex justify-between py-1.5 text-sm bg-blue-100 -mx-2 px-2 rounded">
          <span className="font-bold text-gray-700">Total Cash to Account For:</span>
          <span className="font-bold text-gray-900">
            ₹{totalCashToAccountFor.toLocaleString('en-IN')}
          </span>
        </div>
        <hr className="my-2 border-blue-200" />

        {/* Other Payment Methods Section */}
        <DataRow label="Gpay (UPI)" value={data.gpay} />
        <DataRow label="Card" value={data.card} />
        <DataRow label="SumUp" value={data.sumup} />
        <hr className="my-2 border-t-2 border-gray-300" />

        {/* Grand Total Section */}
        <div className="flex justify-between py-1.5 text-base">
          <span className="font-bold text-gray-800">Total Sales:</span>
          <span className="font-bold text-lg text-blue-900">
            ₹{data.total.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
    </Card>
  );
};