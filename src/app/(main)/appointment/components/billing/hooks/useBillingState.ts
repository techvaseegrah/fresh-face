import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import { getSession } from 'next-auth/react';
import {
  BillLineItem, SearchableItem, AppointmentForModal, CustomerForModal, StylistForModal,
  FinalizeBillingPayload, FinalizedInvoice, BusinessDetails, StaffMember, BillingTotals
} from '../billing.types';

// --- START ADDITION: Define Gift Card state type ---
interface AppliedGiftCard {
  cardId: string;
  code: string;
  amountToApply: number;
  originalBalance: number;
}
// --- END ADDITION ---

interface UseBillingStateProps {
  isOpen: boolean;
  appointment: AppointmentForModal;
  customer: CustomerForModal;
  stylist: StylistForModal;
  onFinalizeAndPay: (payload: FinalizeBillingPayload) => Promise<FinalizedInvoice>;
}

export const useBillingState = ({ isOpen, appointment, customer, stylist, onFinalizeAndPay }: UseBillingStateProps) => {
  
  // =================================================================================
  // I. STATE MANAGEMENT
  // =================================================================================

  // --- Modal & UI Flow ---
  const [modalView, setModalView] = useState<'billing' | 'success'>('billing');
  const [finalizedInvoiceData, setFinalizedInvoiceData] = useState<FinalizedInvoice | null>(null);

  // --- Core Billing Data ---
  const [billItems, setBillItems] = useState<BillLineItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [newPaymentDetails, setNewPaymentDetails] = useState({ cash: 0, card: 0, upi: 0, other: 0 });
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  
  // --- START ADDITION: Gift Card State ---
  const [appliedGiftCard, setAppliedGiftCard] = useState<AppliedGiftCard | null>(null);
  // --- END ADDITION ---

  // --- Customer & Membership ---
  const [customerIsMember, setCustomerIsMember] = useState<boolean>(false);
  const [showMembershipGrantOption, setShowMembershipGrantOption] = useState<boolean>(false);
  const [isGrantingMembership, setIsGrantingMembership] = useState<boolean>(false);
  const [membershipGranted, setMembershipGranted] = useState<boolean>(false);
  const [membershipBarcode, setMembershipBarcode] = useState<string>('');
  const [isBarcodeValid, setIsBarcodeValid] = useState<boolean>(true);
  
  // --- Item Search ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchableItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Staff & Selection ---
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [billingProcessors, setBillingProcessors] = useState<StaffMember[]>([]);
  
  // --- Data & API Results ---
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails | null>(null);
  const [inventoryImpact, setInventoryImpact] = useState<any>(null);
  const [membershipFee, setMembershipFee] = useState<number | null>(null);
  
  // --- Loading & Error States ---
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingBill, setIsLoadingBill] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isCheckingBarcode, setIsCheckingBarcode] = useState<boolean>(false);
  const [isLoadingFee, setIsLoadingFee] = useState<boolean>(true);
  const [isLoadingStaff, setIsLoadingStaff] = useState<boolean>(false);
  const [isLoadingProcessors, setIsLoadingProcessors] = useState<boolean>(false);
  const [isLoadingBusinessDetails, setIsLoadingBusinessDetails] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  
  // =================================================================================
  // II. DERIVED STATE & MEMOS
  // =================================================================================

  const isCorrectionMode = useMemo(() => appointment.status === 'Paid', [appointment.status]);
  const originalAmountPaid = useMemo(() => isCorrectionMode ? (appointment.finalAmount || 0) : 0, [appointment, isCorrectionMode]);
  const originalPaymentDetails = useMemo(() => isCorrectionMode ? (appointment.paymentDetails || { cash: 0, card: 0, upi: 0, other: 0 }) : { cash: 0, card: 0, upi: 0, other: 0 }, [appointment, isCorrectionMode]);

  const totals: BillingTotals = useMemo(() => {
    let serviceTotal = 0, productTotal = 0, membershipSavings = 0, feeTotal = 0, giftCardTotal = 0;
    billItems.forEach(item => {
        if (item.itemType === 'service') { serviceTotal += item.finalPrice; if (customerIsMember && typeof item.membershipRate === 'number') { membershipSavings += (item.unitPrice - item.membershipRate) * item.quantity; } } 
        else if (item.itemType === 'product') { productTotal += item.finalPrice; } 
        else if (item.itemType === 'fee') { feeTotal += item.finalPrice; }
        // --- START ADDITION: Include gift card purchases in subtotal ---
        else if (item.itemType === 'gift_card') { giftCardTotal += item.finalPrice; }
        // --- END ADDITION ---
    });
    const subtotalBeforeDiscount = serviceTotal + productTotal + feeTotal + giftCardTotal;
    let calculatedDiscount = discountType === 'fixed' ? discount : (subtotalBeforeDiscount * discount) / 100;
    calculatedDiscount = Math.min(subtotalBeforeDiscount, calculatedDiscount);
    const trueGrandTotal = subtotalBeforeDiscount - calculatedDiscount;
    const amountDifference = isCorrectionMode ? trueGrandTotal - originalAmountPaid : trueGrandTotal;
    
    // --- START MODIFICATION: Factor in applied gift card ---
    const giftCardPayment = appliedGiftCard?.amountToApply || 0;
    const amountDueForDisplay = Math.max(0, amountDifference - giftCardPayment);
    // --- END MODIFICATION ---

    const refundDue = Math.max(0, -(amountDifference - giftCardPayment));
    const totalNewPaid = Object.values(newPaymentDetails).reduce((sum, amount) => sum + amount, 0);
    const balance = amountDueForDisplay - totalNewPaid;
    const changeDue = balance < 0 ? Math.abs(balance) : 0;
    return { serviceTotal, productTotal, subtotalBeforeDiscount, membershipSavings, calculatedDiscount, trueGrandTotal, displayTotal: amountDueForDisplay, refundDue, totalNewPaid, balance, changeDue };
  }, [billItems, customerIsMember, newPaymentDetails, discount, discountType, originalAmountPaid, isCorrectionMode, appliedGiftCard]);

  // =================================================================================
  // III. CORE UTILITIES
  // =================================================================================

  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const session = await getSession();
    if (!session?.user?.tenantId) { throw new Error("Your session is invalid. Please log in again."); }
    const headers = { ...options.headers, 'x-tenant-id': session.user.tenantId };
    if (options.body) { (headers as any)['Content-Type'] = 'application/json'; }
    return fetch(url, { ...options, headers });
  }, []);

  const resetModalState = useCallback(() => {
    setModalView('billing');
    setFinalizedInvoiceData(null);
    setBillItems([]);
    setNotes('');
    setIsLoading(false);
    setError(null);
    setInventoryImpact(null);
    setSearchQuery('');
    setSearchResults([]);
    setCustomerIsMember(false);
    setShowMembershipGrantOption(false);
    setIsGrantingMembership(false);
    setMembershipGranted(false);
    setSelectedStaffId('');
    setNewPaymentDetails({ cash: 0, card: 0, upi: 0, other: 0 });
    setMembershipBarcode('');
    setIsBarcodeValid(true);
    setDiscount(0);
    setDiscountType('fixed');
    setAppliedGiftCard(null); // --- ADDITION: Reset applied gift card ---
  }, []);

  // =================================================================================
  // IV. DATA FETCHING CALLBACKS
  // =================================================================================

  const fetchBusinessDetails = useCallback(async () => { setIsLoadingBusinessDetails(true); try { const res = await fetch('/api/settings/business-details'); const data = await res.json(); if (data.success && data.details) { setBusinessDetails(data.details); } else { setBusinessDetails({ name: 'Your Salon Name', address: '123 Beauty Street, Your City', phone: '9876543210' }); } } catch (err) { console.error('Failed to fetch business details:', err); setBusinessDetails({ name: 'Your Salon Name', address: '123 Beauty Street, Your City', phone: '9876543210' }); } finally { setIsLoadingBusinessDetails(false); } }, []);
  const fetchInventoryImpact = useCallback(async (currentBillItems: BillLineItem[]) => { const serviceItems = currentBillItems.filter(item => item.itemType === 'service'); if (serviceItems.length === 0 || !customer._id) { setInventoryImpact(null); return; } setIsLoadingInventory(true); try { const serviceIds = serviceItems.map(s => s.itemId); const response = await tenantFetch('/api/billing/inventory-preview', { method: 'POST', body: JSON.stringify({ serviceIds, customerId: customer._id }) }); const data = await response.json(); if (data.success) setInventoryImpact(data.data); } catch (err) { console.error('Failed to fetch inventory impact:', err); } finally { setIsLoadingInventory(false); } }, [customer._id, tenantFetch]);
  const fetchAllActiveStaff = useCallback(async () => { setIsLoadingStaff(true); try { const res = await tenantFetch('/api/staff?action=listForBilling'); const data = await res.json(); if (data.success) setAvailableStaff(data.staff); } catch (err) { console.error('Failed to fetch all active staff:', err); } finally { setIsLoadingStaff(false); } }, [tenantFetch]);
  const fetchBillingProcessors = useCallback(async () => { setIsLoadingProcessors(true); try { const res = await tenantFetch('/api/users/billing-staff'); const data = await res.json(); if (data.success) { setBillingProcessors(data.staff); const session = await getSession(); const currentUserId = session?.user?.id; if (currentUserId && data.staff.some((s: StaffMember) => s._id === currentUserId)) { setSelectedStaffId(currentUserId); } } } catch (err) { console.error('Failed to fetch billing processors:', err); } finally { setIsLoadingProcessors(false); } }, [tenantFetch]);
  const fetchMembershipFee = useCallback(async () => { setIsLoadingFee(true); try { const res = await tenantFetch('/api/settings/membership'); const data = await res.json(); if (data.success && typeof data.price === 'number') setMembershipFee(data.price); else setError('Error: Membership fee is not configured.'); } catch (err) { setError('Error: Membership fee is not configured.'); } finally { setIsLoadingFee(false); } }, [tenantFetch]);
  
  // =================================================================================
  // V. SIDE EFFECTS (useEffect)
  // =================================================================================

  // --- Main Initialization Effect ---
  useEffect(() => { if (!isOpen) return; const initialize = async () => { resetModalState(); fetchAllActiveStaff(); fetchBillingProcessors(); fetchMembershipFee(); fetchBusinessDetails(); const isMember = customer?.isMembership || false; setCustomerIsMember(isMember); setShowMembershipGrantOption(!isMember); if (isCorrectionMode && appointment.invoiceId) { setIsLoadingBill(true); try { const invoiceIdToFetch = typeof appointment.invoiceId === 'object' ? (appointment.invoiceId as { _id: string })._id : appointment.invoiceId; if (!invoiceIdToFetch) { throw new Error("A valid Invoice ID could not be found."); } const res = await tenantFetch(`/api/billing/${invoiceIdToFetch}`); const result = await res.json(); if (!res.ok) throw new Error(result.message || 'Failed to fetch invoice.'); const { invoice } = result; const itemsFromInvoice: BillLineItem[] = invoice.lineItems.map((item: any) => ({ ...item, isRemovable: true })); setBillItems(itemsFromInvoice); setNotes(invoice.notes || ''); if (invoice.billingStaffId) setSelectedStaffId(invoice.billingStaffId); setDiscount(invoice.manualDiscount?.value || 0); setDiscountType(invoice.manualDiscount?.type || 'fixed'); await fetchInventoryImpact(itemsFromInvoice); } catch (err: any) { setError(`Could not load bill: ${err.message}`); setBillItems([]); } finally { setIsLoadingBill(false); } } else { const initialItems = appointment.serviceIds?.map(service => { const finalPrice = (customer?.isMembership && typeof service.membershipRate === 'number') ? service.membershipRate : service.price; return { itemType: 'service' as const, itemId: service._id, name: service.name, unitPrice: service.price, membershipRate: service.membershipRate, quantity: 1, finalPrice, staffId: stylist._id, isRemovable: !isCorrectionMode }; }) ?? []; setBillItems(initialItems); if (initialItems.length > 0) await fetchInventoryImpact(initialItems); } }; initialize(); }, [isOpen, appointment, customer, stylist, isCorrectionMode, fetchAllActiveStaff, fetchBillingProcessors, fetchMembershipFee, tenantFetch, resetModalState, fetchBusinessDetails, fetchInventoryImpact]);
  // --- Update item prices on membership status change ---
  useEffect(() => { setBillItems(prevItems => prevItems.map(item => { if (item.itemType === 'service') { const unitPrice = (customerIsMember && typeof item.membershipRate === 'number') ? item.membershipRate : item.unitPrice; return { ...item, finalPrice: unitPrice * item.quantity }; } return item; })); }, [customerIsMember]);
  // --- Debounced item search ---
  useEffect(() => { if (searchQuery.trim().length < 2) { setSearchResults([]); return; } const handler = setTimeout(async () => { setIsSearching(true); try { const res = await tenantFetch(`/api/billing/search-items?query=${encodeURIComponent(searchQuery)}`); const data = await res.json(); if (data.success) setSearchResults(data.items); } catch (e) { console.error('Item search failed:', e); } finally { setIsSearching(false); } }, 400); return () => clearTimeout(handler); }, [searchQuery, tenantFetch]);
  // --- Debounced membership barcode check ---
  useEffect(() => { if (!membershipBarcode.trim()) { setIsBarcodeValid(true); return; } const handler = setTimeout(async () => { setIsCheckingBarcode(true); try { const res = await tenantFetch(`/api/customer/check-barcode?barcode=${encodeURIComponent(membershipBarcode.trim())}`); const data = await res.json(); setIsBarcodeValid(!data.exists); } catch (err) { setIsBarcodeValid(false); } finally { setIsCheckingBarcode(false); } }, 500); return () => clearTimeout(handler); }, [membershipBarcode, tenantFetch]);
  
  // =================================================================================
  // VI. EVENT HANDLERS
  // =================================================================================

  const handleAddItemToBill = useCallback((item: SearchableItem) => {
    if (billItems.some(bi => bi.itemId === item.id)) { toast.info(`${item.name} is already in the bill.`); return; }

    const finalPrice = (customerIsMember && item.type === 'service' && typeof item.membershipRate === 'number') ? item.membershipRate : item.price;
    let displayName = item.name;
    if (item.type === 'product') { if (item.categoryName) displayName = `${item.categoryName} - ${displayName}`; if (item.unit) displayName = `${displayName} (${item.unit})`; }

    const newItem: BillLineItem = {
      itemType: item.type,
      itemId: item.id,
      name: displayName,
      unitPrice: item.price,
      membershipRate: item.membershipRate,
      quantity: 1,
      finalPrice: finalPrice,
      staffId: item.type === 'gift_card' ? undefined : stylist._id, // --- MODIFICATION: Don't assign staff to gift cards ---
      isRemovable: true
    };
    
    const updatedBillItems = [...billItems, newItem];
    setBillItems(updatedBillItems);
    if (item.type === 'service') fetchInventoryImpact(updatedBillItems); // Only fetch for services

    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  }, [billItems, customerIsMember, stylist._id, fetchInventoryImpact]);

  const handleRemoveItem = useCallback((indexToRemove: number) => { const updatedBillItems = billItems.filter((_, idx) => idx !== indexToRemove); setBillItems(updatedBillItems); fetchInventoryImpact(updatedBillItems); }, [billItems, fetchInventoryImpact]);
  const handleQuantityChange = useCallback((index: number, newQuantity: number) => { if (newQuantity < 1) return; setBillItems(prev => prev.map((item, idx) => { if (idx === index) { const unitPriceForCalc = (customerIsMember && item.itemType === 'service' && typeof item.membershipRate === 'number') ? item.membershipRate : item.unitPrice; return { ...item, quantity: newQuantity, finalPrice: unitPriceForCalc * newQuantity }; } return item; })); }, [customerIsMember]);
  const handleItemStaffChange = useCallback((index: number, newStaffId: string) => { setBillItems(prev => prev.map((item, idx) => { if (idx === index) { return { ...item, staffId: newStaffId }; } return item; })); }, []);
  const handlePaymentChange = useCallback((method: keyof typeof newPaymentDetails, amount: string) => { setNewPaymentDetails(prev => ({ ...prev, [method]: parseFloat(amount) || 0 })); }, []);
  const handleGrantMembership = useCallback(async () => { if (isLoadingFee || membershipFee === null) { toast.error("Membership fee not configured."); return; } if (!membershipBarcode.trim() || !isBarcodeValid) { setError('Please enter a unique, valid barcode.'); return; } if (billItems.some(item => item.itemId === 'MEMBERSHIP_FEE_PRODUCT_ID')) { toast.info("Membership fee is already in the bill."); return; } try { const response = await tenantFetch(`/api/customer/${customer._id}/toggle-membership`, { method: 'POST', body: JSON.stringify({ isMembership: true, membershipBarcode: membershipBarcode.trim() }) }); const result = await response.json(); if (result.success) { setCustomerIsMember(true); setShowMembershipGrantOption(false); setMembershipGranted(true); setIsGrantingMembership(false); toast.success(`Membership granted! Fee added to bill.`); const membershipFeeItem: BillLineItem = { itemType: 'fee', itemId: 'MEMBERSHIP_FEE_PRODUCT_ID', name: 'New Membership Fee', unitPrice: membershipFee, quantity: 1, finalPrice: membershipFee, staffId: stylist._id, isRemovable: false }; setBillItems(prevItems => [...prevItems, membershipFeeItem]); } else { setError(result.message || 'Failed to grant membership'); } } catch (err) { setError('An unexpected error occurred while granting membership.'); } }, [isLoadingFee, membershipFee, membershipBarcode, isBarcodeValid, billItems, tenantFetch, customer._id, stylist._id]);
  const handlePrintReceipt = useCallback(() => window.print(), []);

  // --- START ADDITION: Gift Card Handlers ---
  const handleApplyGiftCard = useCallback((cardData: { cardId: string; code: string; balance: number }) => {
    // We access `totals` via a function call to ensure we get the latest calculated value
    const currentTotals = totals;
    const amountToApply = Math.min(cardData.balance, currentTotals.trueGrandTotal - (appliedGiftCard?.amountToApply || 0));

    if (amountToApply <= 0) {
      toast.info("The bill is already fully covered.");
      return;
    }

    setAppliedGiftCard({
        cardId: cardData.cardId,
        code: cardData.code,
        amountToApply: amountToApply,
        originalBalance: cardData.balance
    });
    toast.success(`₹${amountToApply.toFixed(2)} from gift card applied.`);
  }, [totals, appliedGiftCard]);

  const handleRemoveGiftCard = useCallback(() => {
    setAppliedGiftCard(null);
    toast.info("Applied gift card has been removed.");
  }, []);
  // --- END ADDITION ---

  const handleFinalizeClick = useCallback(async () => {
    if (billItems.length === 0 || totals.trueGrandTotal < 0) { setError('Cannot finalize an empty or negative value bill.'); return; }
    if (!selectedStaffId) { setError('Please select a billing staff member.'); return; }
    // --- MODIFICATION: Ignore staff requirement for gift cards ---
    if (billItems.some(item => !item.staffId && item.itemType !== 'gift_card')) { setError('Please assign a staff member to every service/product.'); toast.error('Assign a staff to every item.'); return; }
    // --- END MODIFICATION ---
    if (totals.balance > 0.01) { setError(`Payment amount (₹${totals.totalNewPaid.toFixed(2)}) is less than the amount due (₹${totals.displayTotal.toFixed(2)}).`); return; }
    
    setIsLoading(true);
    setError(null);
    try {
        const finalPaymentDetails = { cash: (originalPaymentDetails.cash || 0) + newPaymentDetails.cash, card: (originalPaymentDetails.card || 0) + newPaymentDetails.card, upi: (originalPaymentDetails.upi || 0) + newPaymentDetails.upi, other: (originalPaymentDetails.other || 0) + newPaymentDetails.other, };
        if (totals.changeDue > 0 && newPaymentDetails.cash > 0) { finalPaymentDetails.cash -= Math.min(newPaymentDetails.cash, totals.changeDue); }

        const finalPayload: FinalizeBillingPayload = {
            appointmentId: appointment._id,
            customerId: customer._id,
            stylistId: stylist._id,
            billingStaffId: selectedStaffId,
            items: billItems,
            serviceTotal: totals.serviceTotal,
            productTotal: totals.productTotal,
            subtotal: totals.subtotalBeforeDiscount,
            membershipDiscount: totals.membershipSavings,
            grandTotal: totals.trueGrandTotal,
            paymentDetails: finalPaymentDetails,
            notes,
            customerWasMember: customer?.isMembership || false,
            membershipGrantedDuringBilling: membershipGranted,
            manualDiscountType: discount > 0 ? discountType : null,
            manualDiscountValue: discount,
            finalManualDiscountApplied: totals.calculatedDiscount,
            // --- START ADDITION: Add gift card data to the payload ---
            giftCardRedemption: appliedGiftCard ? {
                cardId: appliedGiftCard.cardId,
                amount: appliedGiftCard.amountToApply
            } : undefined,
            // --- END ADDITION ---
        };

        const invoiceData = await onFinalizeAndPay(finalPayload);
        setFinalizedInvoiceData(invoiceData);
        setModalView('success');
    } catch (err: any) { setError(err.message || "An unknown error occurred during finalization."); } finally { setIsLoading(false); }
  }, [ billItems, totals, selectedStaffId, originalPaymentDetails, newPaymentDetails, appointment._id, customer, stylist._id, notes, membershipGranted, discount, discountType, onFinalizeAndPay, appliedGiftCard ]);
  
  // =================================================================================
  // VII. RETURNED VALUES
  // =================================================================================

  return {
    // --- State & Derived Values ---
    modalView,
    finalizedInvoiceData,
    billItems,
    notes,
    newPaymentDetails,
    discount,
    discountType,
    customerIsMember,
    membershipGranted,
    showMembershipGrantOption,
    isGrantingMembership,
    membershipBarcode,
    isBarcodeValid,
    membershipFee,
    searchQuery,
    searchResults,
    selectedStaffId,
    availableStaff,
    billingProcessors,
    businessDetails,
    inventoryImpact,
    isCorrectionMode,
    originalAmountPaid,
    totals,
    appliedGiftCard, // --- ADDITION: Expose gift card state ---

    // --- Loading & Status Flags ---
    error,
    isLoading,
    isLoadingBill,
    isSearching,
    isCheckingBarcode,
    isLoadingFee,
    isLoadingStaff,
    isLoadingProcessors,
    isLoadingBusinessDetails,
    isLoadingInventory,

    // --- Handlers & Setters ---
    setNotes,
    setDiscount,
    setDiscountType,
    setIsGrantingMembership,
    setMembershipBarcode,
    setSearchQuery,
    setSelectedStaffId,
    handleAddItemToBill,
    handleRemoveItem,
    handleQuantityChange,
    handleGrantMembership,
    handlePaymentChange,
    handleItemStaffChange,
    handleFinalizeClick,
    handlePrintReceipt,
    handleApplyGiftCard, // --- ADDITION: Expose gift card handlers ---
    handleRemoveGiftCard, // --- ADDITION: Expose gift card handlers ---

    // --- Refs ---
    searchInputRef,
  };
};