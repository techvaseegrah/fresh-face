// appointment/components/billing/BillItemsTable.tsx

import React from 'react';
import { BillLineItem, StaffMember } from './billing.types';

interface BillItemsTableProps {
  items: BillLineItem[];
  customerIsMember: boolean;
  availableStaff: StaffMember[];
  isLoadingStaff: boolean;
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, newQuantity: number) => void;
  onStaffChange: (id: string, newStaffId: string) => void;
}

const BillItemsTable: React.FC<BillItemsTableProps> = ({
  items, customerIsMember, availableStaff, isLoadingStaff, onRemove, onQuantityChange, onStaffChange
}) => {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
        <p>No items in bill.</p>
      </div>
    );
  }

  return (
    <div className="md:border md:rounded-lg md:overflow-hidden">
      <table className="w-full text-sm">
        <thead className="hidden md:table-header-group bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">Item / Assigned Staff</th>
            <th className="px-4 py-3 text-center w-24">Qty</th>
            <th className="px-4 py-3 text-right">Unit Price</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-center w-24">Action</th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {items.map((item) => (
            <tr key={item.id} className="block md:table-row mb-4 md:mb-0 p-3 border rounded-lg md:border-0 md:border-b md:p-0 hover:bg-gray-50">
              <td className="block md:table-cell px-1 py-2 md:px-4 md:py-3" data-label="Item">
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className={`ml-2 text-xs capitalize px-1.5 py-0.5 rounded-full ${item.itemType === 'service' ? 'bg-blue-100 text-blue-800' : item.itemType === 'product' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>{item.itemType}</span>
                </div>
                {customerIsMember && item.itemType === 'service' && typeof item.membershipRate === 'number' && (
                  <div className="text-xs text-green-600 mt-1">
                    <span className="line-through text-gray-400">₹{item.unitPrice.toFixed(2)}</span>
                    <span className="ml-2">Member Price</span>
                  </div>
                )}
                <div className="mt-2">
                  <select
                    value={item.staffId || ''}
                    onChange={(e) => onStaffChange(item.id, e.target.value)}
                    className="w-full max-w-full sm:max-w-[200px] p-1 border rounded text-xs bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    // ✅ CORRECTED: Removed the logic that disabled this dropdown for gift_card and package items.
                    disabled={isLoadingStaff}
                  >
                    <option value="" disabled>-- Assign Staff --</option>
                    {availableStaff.map(staff => (
                      <option key={staff._id} value={staff._id}>{staff.name}</option>
                    ))}
                  </select>
                </div>
              </td>
              <td className="block md:table-cell px-1 py-2 md:px-4 md:py-3 md:text-center" data-label="Qty">
                <span className="font-bold md:hidden">Qty: </span>
                <input 
                  type="number" 
                  min="1" 
                  value={item.quantity} 
                  onChange={(e) => onQuantityChange(item.id, parseInt(e.target.value) || 1)} 
                  className="w-16 px-2 py-1 border rounded text-center inline-block ml-2 md:ml-0" 
                  disabled={item.isRedemption}
                />
              </td>
              <td className="block md:table-cell px-1 py-2 md:px-4 md:py-3 md:text-right" data-label="Unit Price">
                <span className="font-bold md:hidden">Unit Price: </span>
                ₹{((customerIsMember && item.itemType === 'service' && typeof item.membershipRate === 'number') ? item.membershipRate : item.unitPrice).toFixed(2)}
              </td>
              <td className="block md:table-cell px-1 py-2 md:px-4 md:py-3 md:text-right font-semibold" data-label="Total">
                <span className="font-bold md:hidden">Total: </span>
                ₹{item.finalPrice.toFixed(2)}
              </td>
              <td className="block md:table-cell px-1 py-2 md:px-4 md:py-3 md:text-center mt-2 md:mt-0" data-label="Action">
                <button onClick={() => onRemove(item.id)} disabled={item.isRemovable === false} className="w-full md:w-auto text-red-500 hover:text-red-700 text-xs px-2 py-2 md:py-1 bg-red-50 md:bg-transparent hover:bg-red-100 rounded disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed">Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BillItemsTable;