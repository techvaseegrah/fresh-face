import { CurrencyRupeeIcon } from '@heroicons/react/24/outline';

interface CostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: number) => void;
  cost: number;
  setCost: (cost: number) => void;
  isLoading: boolean;
}

export default function CostModal({ isOpen, onClose, onSave, cost, setCost, isLoading }: CostModalProps) {
  if (!isOpen) return null;

  const handleSave = () => {
    if (cost < 0) {
      alert('Cost must be a positive number.');
      return;
    }
    onSave(cost);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900">Set Cost Per Unit</h2>
        <p className="text-sm text-gray-600 mt-1">This cost will be applied to all currently displayed readings.</p>
        
        <div className="mt-4">
          <label htmlFor="cost" className="block text-sm font-medium text-gray-700">
            Cost (INR)
          </label>
          <div className="relative mt-1 rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <CurrencyRupeeIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="number"
              name="cost"
              id="cost"
              className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
              placeholder="0.00"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            // FIX: The class string is now correctly wrapped in backticks to form a valid template literal.
            className={`inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save and Recalculate'}
          </button>
        </div>
      </div>
    </div>
  );
}