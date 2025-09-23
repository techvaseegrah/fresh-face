'use client';
import React from 'react';
import { XMarkIcon, SparklesIcon, ShoppingCartIcon } from '@heroicons/react/24/solid';
import { AppointmentFormData, AppointmentItemState, CustomerDetails, SearchableItem, CustomerPackage, ServiceAppointmentItem } from './types';

interface AppointmentDetailsFormProps {
  formData: AppointmentFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  selectedCustomerDetails: CustomerDetails | null;
  customerPackages: CustomerPackage[];
  isLoadingPackages: boolean;
  packageError: string | null;
  handleRedeemItem: (pkg: CustomerPackage, item: CustomerPackage['remainingItems'][0]) => void;
  itemSearch: string;
  setItemSearch: (search: string) => void;
  filteredItems: SearchableItem[];
  handleAddItem: (item: SearchableItem) => void;
  appointmentItems: AppointmentItemState[];
  handleRemoveItem: (tempId: string) => void;
  handleUpdateItem: (tempId: string, updates: Partial<ServiceAppointmentItem>) => void;
  total: number;
  membershipSavings: number;
}

const AppointmentDetailsForm: React.FC<AppointmentDetailsFormProps> = ({
  formData, handleChange, selectedCustomerDetails, customerPackages,
  isLoadingPackages, packageError, handleRedeemItem, itemSearch, setItemSearch,
  filteredItems, handleAddItem, appointmentItems, handleRemoveItem, handleUpdateItem,
  total, membershipSavings
}) => {
  const inputBaseClasses = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 text-sm';
  const fieldsetClasses = 'border border-gray-200 p-4 rounded-lg';
  const legendClasses = 'text-base font-semibold text-gray-800 px-2 -ml-2';
  const today = new Date().toISOString().split('T')[0];


  return (
    <fieldset className={fieldsetClasses}>
      <legend className={legendClasses}>Schedule & Items</legend>
      <div className="mt-3"><label htmlFor="status" className="block text-sm font-medium mb-1.5">Status <span className="text-red-500">*</span></label><select id="status" name="status" value={formData.status} onChange={handleChange} className={inputBaseClasses}><option value="Appointment">Appointment (Online Booking)</option><option value="Checked-In">Checked-In (Walk-in Customer)</option></select>{formData.status === 'Checked-In' && (<p className="text-sm text-gray-500 mt-1">Service starts now.</p>)}</div>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 mt-5">
       <div>
            <label htmlFor="date" className="block text-sm font-medium mb-1.5">Date <span className="text-red-500">*</span></label>
            {/* ✅ FIX #2: Add the min attribute to the input */}
            <input 
              id="date" 
              type="date" 
              name="date" 
              value={formData.date} 
              onChange={handleChange} 
              required 
              min={today} // <-- THIS IS THE CHANGE
              className={`${inputBaseClasses} ${formData.status === 'Checked-In' ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
              readOnly={formData.status === 'Checked-In'} 
            />
        </div>
        <div><label htmlFor="time" className="block text-sm font-medium mb-1.5">Time <span className="text-red-500">*</span></label><input id="time" type="time" name="time" value={formData.time} onChange={handleChange} required className={`${inputBaseClasses} ${formData.status === 'Checked-In' ? 'bg-gray-100 cursor-not-allowed' : ''}`} readOnly={formData.status === 'Checked-In'} /></div>
      </div>

      {selectedCustomerDetails && (customerPackages.length > 0 || isLoadingPackages) && (
        <div className="mt-5">
          <label className="block text-sm font-medium mb-1.5">Redeem from Package</label>
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            {isLoadingPackages && <p className="text-xs text-gray-500">Loading available packages...</p>}
            {packageError && <p className="text-xs text-red-600">{packageError}</p>}
            <div className="space-y-3">
              {customerPackages.map(pkg => (
                <div key={pkg._id}>
                  <h5 className="font-semibold text-sm text-indigo-800">{pkg.packageName}</h5>
                  <ul className="pl-2 mt-1 space-y-1">
                    {pkg.remainingItems.filter(i => i.remainingQuantity > 0).map(item => (
                      <li key={item.itemId} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{item.itemName} ({item.remainingQuantity} left)</span>
                        <button type="button" onClick={() => handleRedeemItem(pkg, item)} disabled={appointmentItems.filter(a => a.itemId === item.itemId && a.isRedeemed).length >= item.remainingQuantity} className="px-2 py-0.5 text-xs font-medium text-indigo-700 bg-indigo-200 rounded-md hover:bg-indigo-300 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">Add to Appointment</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5">
        <label className="block text-sm font-medium mb-1.5">Add Services or Products <span className="text-red-500">*</span></label>
        <div className="relative">
          <input type="text" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search services or products..." className={`${inputBaseClasses} pr-8`} />
          {itemSearch && filteredItems.length > 0 && (
            <ul className="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
              {filteredItems.map((item) => (
                <li key={`${item.type}-${item._id}`} onClick={() => handleAddItem(item)} className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                  <div>{item.name}<span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${item.type === 'service' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{item.type === 'service' ? 'Service' : 'Product'}</span></div>
                  <span className="font-semibold">₹{item.price}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {appointmentItems.map((item, index) => (
          <div key={item._tempId} className={`p-4 rounded-lg border space-y-3 ${item.isRedeemed ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-start justify-between">
              <div className="font-semibold text-gray-800 flex items-center gap-2">
                {item.type === 'service' ? <SparklesIcon className="w-5 h-5 text-blue-500" /> : <ShoppingCartIcon className="w-5 h-5 text-green-500" />}
                <span>{index + 1}. {item.itemName}</span>
                {item.type === 'service' && <span className="text-xs font-normal text-gray-500">({item.duration} mins)</span>}
                {item.isRedeemed && <span className="ml-2 text-xs font-semibold text-indigo-800 bg-indigo-200 px-2 py-0.5 rounded-full">Package</span>}
              </div>
              <button type="button" onClick={() => handleRemoveItem(item._tempId)} className="p-1 text-red-500 hover:bg-red-100 rounded-full" title="Remove Item"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            {item.type === 'service' && (
              <div className="grid md:grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <label htmlFor={`guestName-${item._tempId}`} className="block text-xs font-medium text-gray-600 mb-1">Service For</label>
                  <input type="text" id={`guestName-${item._tempId}`} placeholder={formData.customerName || "Main Customer"} value={item.guestName || ''} onChange={(e) => handleUpdateItem(item._tempId, { guestName: e.target.value })} className={`${inputBaseClasses} py-2 text-sm`} />
                </div>
                <div>
                  <label htmlFor={`stylist-${item._tempId}`} className="block text-xs font-medium text-gray-600 mb-1">Assigned Staff <span className="text-red-500">*</span></label>
                  <select id={`stylist-${item._tempId}`} value={item.stylistId} onChange={(e) => handleUpdateItem(item._tempId, { stylistId: e.target.value })} required disabled={!formData.date || !formData.time || item.isLoadingStylists} className={`${inputBaseClasses} py-2 text-sm disabled:bg-gray-100/80`}>
                    <option value="" disabled>{item.isLoadingStylists ? 'Finding staff...' : 'Select a staff member'}</option>
                    {item.availableStylists.length > 0 ? (item.availableStylists.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))) : (!item.isLoadingStylists && <option disabled>No staff available</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {appointmentItems.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Total Amount:</span>
            <div className="text-right">
              <span className="text-lg font-bold text-green-600">₹{total.toFixed(2)}</span>
              {membershipSavings > 0 && (<div className="text-xs text-green-500 mt-1">Saved ₹{membershipSavings.toFixed(2)} with membership</div>)}
            </div>
          </div>
        </div>
      )}
      <div className="mt-5"><label htmlFor="notes" className="block text-sm font-medium mb-1.5">Notes</label><textarea id="notes" name="notes" rows={3} value={formData.notes || ''} onChange={handleChange} className={`${inputBaseClasses} resize-none`} placeholder="Any special requirements or notes..." /></div>
    </fieldset>
  );
};

export default AppointmentDetailsForm;