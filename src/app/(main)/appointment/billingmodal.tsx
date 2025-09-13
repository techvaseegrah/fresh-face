'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppointmentForModal, CustomerForModal, StylistForModal, FinalizeBillingPayload, FinalizedInvoice } from './components/billing/billing.types';
import { useBillingState } from './components/billing/hooks/useBillingState';

import BillingHeader from './components/billing/BillingHeader';
import GrantMembership from './components/billing/GrantMembership';
import BillItemsTable from './components/billing/BillItemsTable';
import ItemSearch from './components/billing/ItemSearch';
import PaymentSection from './components/billing/PaymentSection';
import BillingTotals from './components/billing/BillingTotals';
import SuccessCard from './components/billing/SuccessCard';
import Receipt from '@/components/Receipt';
import ApplyGiftCardModal from './components/billing/ApplyGiftCardModal';
import RedeemPackageModal from './components/billing/RedeemPackageModal';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentForModal;
  customer: CustomerForModal;
  stylist: StylistForModal;
  onFinalizeAndPay: (payload: FinalizeBillingPayload) => Promise<FinalizedInvoice>;
}

const CustomerHistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; customer: CustomerForModal | null; }> = ({ isOpen, onClose, customer }) => {
  if (!isOpen) return null;
  return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
              <h2 className="text-xl font-semibold mb-4">History for {customer?.name}</h2>
              <p className="text-gray-600">
              A full implementation would fetch and display the customer's visit and purchase history here.
              </p>
              <div className="mt-6 text-right">
                  <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                    Close
                  </button>
              </div>
          </div>
      </div>
  );
};

const BillingModal: React.FC<BillingModalProps> = (props) => {
  const { isOpen, onClose, customer } = props;
  const [isClient, setIsClient] = useState(false);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [isGiftCardModalOpen, setIsGiftCardModalOpen] = useState(false);
  const [isRedeemPackageModalOpen, setIsRedeemPackageModalOpen] = useState(false);

  const state = useBillingState(props);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleApplyGiftCardSuccess = (cardData: { cardId: string; code: string; balance: number }) => {
    state.handleApplyGiftCard(cardData);
    setIsGiftCardModalOpen(false);
  };

  if (!isOpen) return null;

  const modalContainerClasses = state.modalView === 'billing'
    ? "bg-white p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col"
    : "w-full h-full flex items-center justify-center";

  // CORRECTED LINE: The check excluding 'gift_card' and 'package' has been removed.
  // Now, ALL items must have a staffId assigned to enable the button.
  const isFinalizeButtonDisabled = state.isLoading || state.isLoadingBill || state.billItems.length === 0 || !state.selectedStaffId || (state.billItems.some(item => !item.staffId)) || state.totals.balance > 0.01;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-2 sm:p-4">
        <div className={modalContainerClasses}>
          {state.modalView === 'billing' ? (
            <>
              <BillingHeader
                isCorrectionMode={state.isCorrectionMode}
                customer={props.customer}
                stylist={props.stylist}
                customerIsMember={state.customerIsMember}
                membershipGranted={state.membershipGranted}
                showMembershipGrantOption={state.showMembershipGrantOption}
                isGrantingMembership={state.isGrantingMembership}
                onShowHistory={() => setShowCustomerHistory(true)}
                onToggleGrantMembership={() => state.setIsGrantingMembership(prev => !prev)}
                onClose={onClose}
              />

              {state.error && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded text-sm flex-shrink-0">
                {state.error}</div>}

              {state.isLoadingBill ? (
                <div className="flex-grow flex items-center justify-center"><div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-black rounded-full mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Loading Bill Details...</p></div></div>
              ) : (
                <>
                  {state.isCorrectionMode && (<div className="flex-shrink-0 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">Payment History</h4>
                  <div className="flex justify-between text-blue-700"><span>Previously Paid:</span>
                  <span className="font-bold"> ₹{state.originalAmountPaid.toFixed(2)}</span></div></div>)}
                  
                  {state.isGrantingMembership && (
                    <GrantMembership 
                        membershipBarcode={state.membershipBarcode}
                        onBarcodeChange={state.setMembershipBarcode}
                        isBarcodeValid={state.isBarcodeValid}
                        isCheckingBarcode={state.isCheckingBarcode}
                        onGrant={state.handleGrantMembership}
                        isLoadingFee={state.isLoadingFee}
                        membershipFee={state.membershipFee}
                    />
                  )}
                  
                  <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-medium text-gray-700">Bill Items ({state.billItems.length})</h3>
                        <button
                          onClick={() => setIsRedeemPackageModalOpen(true)}
                          className="px-3 py-1 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200 transition-colors"
                        >
                          Redeem from Package
                        </button>
                      </div>
                      <BillItemsTable
                          items={state.billItems}
                          customerIsMember={state.customerIsMember}
                          availableStaff={state.availableStaff}
                          isLoadingStaff={state.isLoadingStaff}
                          onRemove={state.handleRemoveItem}
                          onQuantityChange={state.handleQuantityChange}
                          onStaffChange={state.handleItemStaffChange}
                      />
                    </div>
                    
                    {state.isLoadingInventory && <div className="text-sm text-gray-500">Loading inventory preview...</div>}
                    {state.inventoryImpact?.inventoryImpact?.length > 0 && (<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-800 mb-3">Inventory Impact ({state.inventoryImpact.customerGender})</h4>
                    <div className="space-y-2">
                      {state.inventoryImpact.inventoryImpact.map((impact: any, index: number) => (<div key={index} className={`p-3 rounded-md border text-sm ${impact.alertLevel === 'insufficient' ? 'bg-red-50 border-red-200' : impact.alertLevel === 'critical' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="flex justify-between items-center"><div><span className="font-medium">{impact.productName}</span>
                        <div className="text-xs text-gray-600">Current: {impact.currentQuantity.toFixed(1)}{impact.unit} → After: {(impact.currentQuantity - impact.usageQuantity).toFixed(1)}{impact.unit}</div></div>
                        <div className="text-right"><div className="font-medium">-{impact.usageQuantity.toFixed(1)}{impact.unit}</div>{impact.alertLevel !== 'ok' && <div className={`text-xs font-bold ${impact.alertLevel === 'insufficient' ? 'text-red-600' : 'text-orange-600'}`}>{impact.alertLevel.toUpperCase()}!</div>}</div></div></div>))}</div></div>)}
                    
                    <ItemSearch 
                        searchQuery={state.searchQuery}
                        onSearchQueryChange={state.setSearchQuery}
                        searchResults={state.searchResults}
                        isSearching={state.isSearching}
                        onAddItem={state.handleAddItemToBill}
                        searchInputRef={state.searchInputRef}
                        customerIsMember={state.customerIsMember}
                    />
                    
                    <div className="pt-4 border-t"><label htmlFor="billingStaff" className="block text-sm font-medium text-gray-700 mb-1">Billing Staff (Processor) <span className="text-red-500">*</span></label><select id="billingStaff" value={state.selectedStaffId} onChange={e => state.setSelectedStaffId(e.target.value)} className="w-full px-3 py-2 border rounded-md" disabled={state.isLoadingProcessors}><option value="">{state.isLoadingProcessors ? 'Loading staff...' : 'Select billing staff'}</option>{state.billingProcessors.map(staff => <option key={staff._id} value={staff._id}>{staff.name} ({staff.email})</option>)}</select></div>
                    
                    <div className="pt-4 border-t"><label className="block text-sm font-medium text-gray-700 mb-2">Manual Discount</label><div className="flex"><div className="relative flex-grow"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">{state.discountType === 'fixed' ? '?' : '%'}</span><input type="number" min="0" value={state.discount || ''} onChange={e => state.setDiscount(parseFloat(e.target.value) || 0)} className="w-full pl-7 pr-3 py-2 border border-r-0 border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0"/></div><button onClick={() => state.setDiscountType('fixed')} className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold border transition-colors ${state.discountType === 'fixed' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>Fixed (?)</button><button onClick={() => state.setDiscountType('percentage')} className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold border border-l-0 rounded-r-md transition-colors ${state.discountType === 'percentage' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>Percent (%)</button></div></div>

                    <PaymentSection
                        newPaymentDetails={state.newPaymentDetails}
                        onPaymentChange={state.handlePaymentChange}
                        totals={state.totals}
                        isCorrectionMode={state.isCorrectionMode}
                        onApplyGiftCardClick={() => setIsGiftCardModalOpen(true)}
                        isGiftCardApplied={!!state.appliedGiftCard}
                    />
                    
                    <div className="mt-4"><label htmlFor="billingNotes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea id="billingNotes" rows={2} value={state.notes} onChange={e => state.setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="Any additional notes..." /></div>
                  </div>
                  
                  <div className="mt-auto pt-3 border-t flex-shrink-0">
                      <BillingTotals 
                        totals={state.totals} 
                        isCorrectionMode={state.isCorrectionMode} 
                        originalAmountPaid={state.originalAmountPaid}
                        appliedGiftCard={state.appliedGiftCard}
                        onRemoveGiftCard={state.handleRemoveGiftCard}
                      />
                      <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 sm:gap-0">
                          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300" disabled={state.isLoading}>
                            Cancel
                          </button>
                          <button onClick={state.handleFinalizeClick} className="px-6 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 min-w-[120px]" disabled={isFinalizeButtonDisabled}>
                            {state.isLoading ? <div className="flex items-center justify-center"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />Processing...</div> : state.isCorrectionMode ? 'Save Correction' : 'Complete Payment'}
                          </button>
                      </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <SuccessCard
                finalizedInvoiceData={state.finalizedInvoiceData}
                onClose={onClose}
                onPrintReceipt={state.handlePrintReceipt}
                isLoadingBusinessDetails={state.isLoadingBusinessDetails}
            />
          )}
        </div>
      </div>
      
      {isClient && createPortal(
        <div className="print-container hidden">
          <Receipt
            invoiceData={state.finalizedInvoiceData as FinalizedInvoice & { membershipDiscount: number; }}
            businessDetails={state.businessDetails} />
        </div>,
        document.body
      )}

      <CustomerHistoryModal 
        isOpen={showCustomerHistory} 
        onClose={() => setShowCustomerHistory(false)} 
        customer={customer} 
      />

      {isGiftCardModalOpen && (
        <ApplyGiftCardModal
          onClose={() => setIsGiftCardModalOpen(false)}
          onApply={handleApplyGiftCardSuccess}
        />
      )}

      {isRedeemPackageModalOpen && (
        <RedeemPackageModal
          customerId={customer._id}
          billItems={state.billItems}
          onRedeem={state.handleRedeemPackageItem}
          onClose={() => setIsRedeemPackageModalOpen(false)}
        />
      )}
    </>
  );
};

export default BillingModal;