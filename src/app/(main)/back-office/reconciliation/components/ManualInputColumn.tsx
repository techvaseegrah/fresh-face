import Card from '@/components/ui/Card';

// ✅ FIX 1: Change the `value` type from `number` to `string`.
type InputField = {
  id: string;
  label: string;
  value: string; // This is the crucial change
};

type DiffField = {
  label: string;
  value: number;
};

interface ManualInputColumnProps {
  title: string;
  themeColor: 'purple' | 'pink';
  fields: InputField[];
  diffs: DiffField[];
  remarksValue: string;
  onInputChange: (id: string, value: string) => void;
  onRemarksChange: (value: string) => void;
}

const DiffDisplay = ({ label, value }: { label: string; value: number }) => (
  <div className={`flex justify-between p-2 mt-2 rounded font-bold text-sm ${value !== 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
    <span>{label}:</span>
    <span>₹{value.toLocaleString('en-IN')}</span>
  </div>
);

export const ManualInputColumn = ({
  title,
  themeColor,
  fields,
  diffs,
  remarksValue,
  onInputChange,
  onRemarksChange,
}: ManualInputColumnProps) => {
  const themeClasses = {
    purple: { border: 'border-purple-200', text: 'text-purple-800' },
    pink: { border: 'border-pink-200', text: 'text-pink-800' },
  };
  const currentTheme = themeClasses[themeColor];

  return (
    <Card className={`p-4 bg-${themeColor}-50/50 shadow-sm flex flex-col`}>
      <h2 className={`text-lg font-bold mb-3 border-b ${currentTheme.border} pb-2 ${currentTheme.text}`}>{title}</h2>
      
      <div className="space-y-4 flex-grow">
        {fields.map(field => (
          <div key={field.id}>
            <label htmlFor={field.id} className="block text-sm font-medium text-gray-700">{field.label}</label>
            <input
              id={field.id}
              type="number"
              // ✅ FIX 2: The `value` prop is now correctly bound to a string.
              value={field.value}
              onChange={(e) => onInputChange(field.id, e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="0"
              readOnly={field.id === 'expenses'}
              disabled={field.id === 'expenses'}
            />
          </div>
        ))}

        <div className="pt-2">
          <label htmlFor={`${title}-remarks`} className="block text-sm font-medium text-gray-700">
            Remarks
          </label>
          <textarea
            id={`${title}-remarks`}
            rows={3}
            value={remarksValue}
            onChange={(e) => onRemarksChange(e.target.value)}
            placeholder="Explain any differences here..."
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-none"
          />
        </div>
      </div>
      
      <div className="mt-auto">
        {diffs.map((diff, index) => (
          <DiffDisplay key={index} label={diff.label} value={diff.value} />
        ))}
      </div>
    </Card>
  );
};