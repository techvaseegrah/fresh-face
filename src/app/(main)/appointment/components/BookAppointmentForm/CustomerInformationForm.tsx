'use client';
import React, { RefObject } from 'react';
import { QrCodeIcon } from '@heroicons/react/24/solid';
import { AppointmentFormData, CustomerSearchResult } from './types';

interface CustomerInformationFormProps {
  formData: AppointmentFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleSelectCustomer: (customer: CustomerSearchResult) => void;
  handleClearSelection: (clearPhone?: boolean) => void;
  isCustomerSelected: boolean;
  customerSearchResults: CustomerSearchResult[];
  isSearchingCustomers: boolean;
  customerLookupStatus: 'idle' | 'searching' | 'found' | 'not_found';
  searchMode: 'phone' | 'barcode';
  setSearchMode: (mode: 'phone' | 'barcode') => void;
  barcodeQuery: string;
  setBarcodeQuery: (query: string) => void;
  handleBarcodeSearch: () => void;
  isSearchingByBarcode: boolean;
  phoneInputRef: RefObject<HTMLInputElement>;
  nameInputRef: RefObject<HTMLInputElement>;
  barcodeInputRef: RefObject<HTMLInputElement>;
}

const CustomerInformationForm: React.FC<CustomerInformationFormProps> = ({
  formData, handleChange, handleSelectCustomer, handleClearSelection, isCustomerSelected,
  customerSearchResults, isSearchingCustomers, customerLookupStatus,
  searchMode, setSearchMode, barcodeQuery, setBarcodeQuery,
  handleBarcodeSearch, isSearchingByBarcode,
  phoneInputRef, nameInputRef, barcodeInputRef
}) => {
  const inputBaseClasses = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/30 text-sm';
  const fieldsetClasses = 'border border-gray-200 p-4 rounded-lg';
  const legendClasses = 'text-base font-semibold text-gray-800 px-2 -ml-2';

  return (
    <fieldset className={fieldsetClasses}>
      <legend className={legendClasses}>Customer Information</legend>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button type="button" onClick={() => setSearchMode('phone')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${searchMode === 'phone' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>Phone Search</button>
          <button type="button" onClick={() => setSearchMode('barcode')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${searchMode === 'barcode' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>Barcode Search</button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 mt-3">
        {searchMode === 'phone' ? (
          <div className="md:col-span-2 relative">
            <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1.5">Phone Number <span className="text-red-500">*</span></label>
            <input ref={phoneInputRef} id="phoneNumber" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required placeholder="Enter 10-digit phone to find or create..." className={inputBaseClasses} autoComplete="off" maxLength={10} />
            {(isSearchingCustomers || customerSearchResults.length > 0) ? ( <ul className="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">{isSearchingCustomers ? ( <li className="px-3 py-2 text-sm text-gray-500">Searching...</li> ) : ( customerSearchResults.map((cust) => ( <li key={cust._id} onClick={() => handleSelectCustomer(cust)} className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer">{cust.name} - <span className="text-gray-500">{cust.phoneNumber}</span></li> )) )}</ul> ) : ( <div className="h-5 mt-1 text-xs">{customerLookupStatus === 'searching' && <span className="text-gray-500 flex items-center gap-1.5"><div className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full" />Checking...</span>}{customerLookupStatus === 'found' && <span className="font-semibold text-green-600">✓ Customer Found.</span>}{customerLookupStatus === 'not_found' && <span className="font-medium text-blue-600">New customer. Fill in details.</span>}</div> )}
          </div>
        ) : (
          <div className="md:col-span-2 relative"><label htmlFor="barcodeQuery" className="block text-sm font-medium mb-1.5">Membership Barcode <span className="text-red-500">*</span></label><div className="flex gap-2"><div className="relative flex-grow"><input ref={barcodeInputRef} id="barcodeQuery" type="text" value={barcodeQuery} onChange={(e) => setBarcodeQuery(e.target.value.toUpperCase())} onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleBarcodeSearch(); } }} placeholder="Scan or enter membership barcode..." className={`${inputBaseClasses} uppercase`} autoComplete="off" /><QrCodeIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" /></div><button type="button" onClick={handleBarcodeSearch} disabled={isSearchingByBarcode || !barcodeQuery.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">{isSearchingByBarcode ? (<><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />Searching...</>) : ('Search')}</button></div></div>
        )}
        <div><label htmlFor="customerName" className="block text-sm font-medium mb-1.5">Full Name <span className="text-red-500">*</span></label><input ref={nameInputRef} id="customerName" type="text" name="customerName" value={formData.customerName} onChange={handleChange} required className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}/></div>
        <div><label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label><input id="email" type="email" name="email" value={formData.email} onChange={handleChange} className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}/></div>
        <div><label htmlFor="gender" className="block text-sm font-medium mb-1.5">Gender <span className="text-red-500">*</span></label><select id="gender" name="gender" value={formData.gender || ''} onChange={handleChange} required className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}><option value="" disabled>Select Gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></div>
        <div><label htmlFor="dob" className="block text-sm font-medium mb-1.5">Date of Birth</label><input id="dob" type="date" name="dob" value={formData.dob} onChange={handleChange} className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}/></div>
        <div className="md:col-span-2"><label htmlFor="survey" className="block text-sm font-medium mb-1.5">How did you hear about us?</label><select id="survey" name="survey" value={formData.survey} onChange={handleChange} className={`${inputBaseClasses} ${isCustomerSelected ? 'bg-gray-100' : ''}`} disabled={isCustomerSelected}><option value="">Select an option</option><option value="Friend/Family Recommendation">Friend/Family Recommendation</option><option value="Social Media (Instagram, Facebook, etc.)">Social Media</option><option value="Google/Online Search">Google/Online Search</option><option value="Walk-in/Passed by">Walk-in/Passed by</option><option value="Previous Visit">Previous Visit</option><option value="Other">Other</option></select></div>
      </div>
      {isCustomerSelected && (<div className="mt-3"><button type="button" onClick={() => handleClearSelection(true)} className="text-xs text-blue-600 hover:underline">Clear Selection & Add New</button></div>)}
    </fieldset>
  );
};

export default CustomerInformationForm;