// appointment/components/billing/BillingHeader.tsx

import React from 'react';
import { ClockIcon, UserPlusIcon } from '@heroicons/react/24/solid';
import { CustomerForModal, StylistForModal } from './billing.types';

interface BillingHeaderProps {
  isCorrectionMode: boolean;
  customer: CustomerForModal;
  stylist: StylistForModal;
  customerIsMember: boolean;
  membershipGranted: boolean;
  showMembershipGrantOption: boolean;
  isGrantingMembership: boolean;
  onShowHistory: () => void;
  onToggleGrantMembership: () => void;
  onClose: () => void;
}

const BillingHeader: React.FC<BillingHeaderProps> = ({
  isCorrectionMode, customer, stylist, customerIsMember, membershipGranted,
  showMembershipGrantOption, isGrantingMembership, onShowHistory, onToggleGrantMembership, onClose
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4 pb-3 border-b">
      <div className="w-full">
        <div className="flex items-center gap-2 sm:gap-4">
          <h2 className="text-lg sm:text-xl font-semibold">
            {isCorrectionMode ? "Correct Bill: " : "Bill for: "}
            <span className="text-indigo-600">{customer.name}</span>
          </h2>
          {customer.phoneNumber && (
            <button onClick={onShowHistory} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Customer History">
              <ClockIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Service by: <span className="font-medium">{stylist.name}</span></span>
          {customerIsMember && <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-semibold">Member Pricing</span>}
          {membershipGranted && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-semibold">Membership Granted</span>}
        </div>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
        {showMembershipGrantOption && !customerIsMember && (
          <button onClick={onToggleGrantMembership} title="Grant Membership" className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 font-semibold transition-all duration-200 border border-yellow-500 text-yellow-700 bg-transparent hover:bg-yellow-50">
            <UserPlusIcon className="w-4 h-4" />
            <span>{isGrantingMembership ? 'Cancel' : 'Grant Membership'}</span>
          </button>
        )}
        <button onClick={onClose} className="text-gray-500 text-2xl hover:text-gray-700">×</button>
      </div>
    </div>
  );
};

export default BillingHeader;