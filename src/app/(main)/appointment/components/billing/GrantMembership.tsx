// appointment/components/billing/GrantMembership.tsx

import React from 'react';
import { QrCodeIcon } from 'lucide-react';

interface GrantMembershipProps {
  membershipBarcode: string;
  onBarcodeChange: (value: string) => void;
  isBarcodeValid: boolean;
  isCheckingBarcode: boolean;
  onGrant: () => void;
  isLoadingFee: boolean;
  membershipFee: number | null;
}

const GrantMembership: React.FC<GrantMembershipProps> = ({
  membershipBarcode, onBarcodeChange, isBarcodeValid, isCheckingBarcode, onGrant, isLoadingFee, membershipFee
}) => {
  return (
    <div className="flex-shrink-0 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg transition-all">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
        <div className="flex-grow">
          <label className="block text-sm font-medium text-yellow-800 mb-1">Enter Membership Barcode to Grant</label>
          <div className="relative">
            <input
              type="text"
              value={membershipBarcode}
              onChange={(e) => onBarcodeChange(e.target.value.toUpperCase())}
              placeholder="Enter unique barcode"
              autoFocus
              className={`w-full px-3 py-2 pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 uppercase ${!isBarcodeValid ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
            />
            <QrCodeIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          {isCheckingBarcode && <p className="text-xs text-gray-500 mt-1">Checking...</p>}
          {!isBarcodeValid && membershipBarcode.trim() && <p className="text-xs text-red-600 mt-1">Barcode already in use.</p>}
        </div>
        <button
          onClick={onGrant}
          disabled={!membershipBarcode.trim() || !isBarcodeValid || isCheckingBarcode || isLoadingFee || membershipFee === null}
          className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2 justify-center"
        >
          {isLoadingFee ? 'Loading Fee...' : `Confirm & Grant (₹${membershipFee})`}
        </button>
      </div>
    </div>
  );
};

export default GrantMembership;