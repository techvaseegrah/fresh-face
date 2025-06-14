// 'use client';

// // React and Heroicons imports
// import React, { useState, useEffect, FormEvent } from 'react';
// import { GiftIcon } from '@heroicons/react/24/outline';

// // --- Interfaces (with loyalty points added) ---
// interface AppointmentHistoryItem {
//   id: string;
//   service: string;
//   stylist?: string;
//   date: string;
//   time: string;
//   status: string;
//   notes?: string;
//   amount?: number;
// }

// interface MembershipUIDetails {
//   planName: string;
//   status: 'Active' | 'Expired' | 'Cancelled' | 'PendingPayment';
//   startDate: string;
//   endDate: string;
//   benefits?: string[];
// }

// interface LoyaltyTransactionItem {
//   id: string;
//   points: number;
//   type: 'Credit' | 'Debit';
//   reason: string;
//   createdAt?: string;
// }

// interface CrmCustomer {
//   id: string;
//   name: string;
//   email: string;
//   phoneNumber: string;
//   createdAt?: string;
//   status?: 'Active' | 'Inactive' | 'New';
//   appointmentHistory?: AppointmentHistoryItem[];
//   currentMembership?: MembershipUIDetails | null;
//   loyaltyPoints?: number;
//   loyaltyHistory?: LoyaltyTransactionItem[];
// }

// interface CrmCustomerDetailPanelProps {
//   customer: CrmCustomer | null;
//   isOpen: boolean;
//   onClose: () => void;
//   onAddMembership: (customerId: string) => void;
//   onDataRefresh: (customerId: string) => Promise<void>;
// }

// // --- Helper Functions (Restored) ---
// const formatDate = (dateString: string | undefined): string => {
//   if (!dateString) return 'N/A';
//   try {
//     return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
//   } catch (e) { return 'Invalid Date'; }
// };

// const formatTime = (timeString: string | undefined): string => {
//   if (!timeString || !timeString.includes(':')) return 'N/A';
//   try {
//     const [hoursStr, minutesStr] = timeString.split(':');
//     const hours = parseInt(hoursStr, 10);
//     const minutes = parseInt(minutesStr, 10);
//     if (isNaN(hours) || isNaN(minutes)) return 'Invalid Time';
//     const ampm = hours >= 12 ? 'PM' : 'AM';
//     const displayHours = hours % 12 || 12;
//     const displayMinutes = minutes < 10 ? `0${minutes}` : minutes.toString();
//     return `${displayHours}:${displayMinutes} ${ampm}`;
//   } catch(e) { return "Invalid Time"; }
// };

// // --- The Component ---
// const CrmCustomerDetailPanel: React.FC<CrmCustomerDetailPanelProps> = ({
//   customer,
//   isOpen,
//   onClose,
//   onAddMembership,
//   onDataRefresh,
// }) => {

//   const [pointsToAdjust, setPointsToAdjust] = useState('');
//   const [adjustmentReason, setAdjustmentReason] = useState('');
//   const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
//   const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

//   useEffect(() => {
//     if (customer) {
//       setPointsToAdjust(''); setAdjustmentReason(''); setAdjustmentError(null); setIsAdjustingPoints(false);
//     }
//   }, [customer]);

//   const handleAddMembershipClick = () => { if (customer) { onAddMembership(customer.id); } };

//   const handleAdjustPoints = async (e: FormEvent) => {
//     e.preventDefault();
//     if (!customer) return;
//     const points = Number(pointsToAdjust);
//     if (isNaN(points) || points === 0) { setAdjustmentError('Please enter a valid, non-zero number.'); return; }
//     if (!adjustmentReason.trim()) { setAdjustmentError('Please provide a reason for the adjustment.'); return; }
//     setIsAdjustingPoints(true); setAdjustmentError(null);
//     try {
//       const response = await fetch(`/api/customer/${customer.id}/points`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ points, reason: adjustmentReason.trim() }),
//       });
//       const result = await response.json();
//       if (!response.ok || !result.success) { throw new Error(result.message || 'Failed to adjust points.'); }
//       await onDataRefresh(customer.id);
//     } catch (error: any) {
//       setAdjustmentError(error.message);
//     } finally {
//       setIsAdjustingPoints(false);
//     }
//   };

//   return (
//     <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl transition-transform duration-300 ease-in-out z-40 w-full md:w-[400px] lg:w-[450px] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden={!isOpen}>
//       {customer ? (
//         <div className="h-full flex flex-col">
//           <div className="p-6 pb-4 border-b border-gray-200 flex-shrink-0 flex justify-between items-center"><h3 className="text-xl font-semibold text-gray-900 truncate pr-2">{customer.name}</h3><button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors" aria-label="Close panel"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
//           <div className="flex-grow overflow-y-auto">
              
//               {/* ===> CUSTOMER DETAILS SECTION (RESTORED) <=== */}
//               <div className="px-6 pt-4 space-y-1.5 text-sm mb-3">
//                   <p className="text-gray-800"><strong>Email:</strong> <a href={`mailto:${customer.email}`} className="text-indigo-600 hover:text-indigo-800 break-all">{customer.email}</a></p>
//                   <p className="text-gray-800"><strong>Phone:</strong> <a href={`tel:${customer.phoneNumber}`} className="text-indigo-600 hover:text-indigo-800">{customer.phoneNumber}</a></p>
//                   <p className="text-gray-800"><strong>Joined:</strong> <span className="text-gray-600">{formatDate(customer.createdAt)}</span></p>
//                   {customer.status && <p className="text-gray-800 flex items-center"><strong className="mr-2">Activity Status:</strong><span className={`px-2 py-0.5 inline-flex text-xs leading-tight font-semibold rounded-full ${customer.status === 'Active' ? 'bg-green-100 text-green-700' : customer.status === 'Inactive' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{customer.status}</span></p>}
//               </div>

//               {/* ===> MEMBERSHIP DETAILS SECTION (RESTORED) <=== */}
//               <div className="px-6 mb-4">
//                   {customer.currentMembership ? (
//                     <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200"><h3 className="text-sm font-semibold text-indigo-800 mb-2">Active Membership</h3><p className="text-indigo-700 text-sm"><strong>Plan:</strong> <span className="font-medium">{customer.currentMembership.planName}</span></p><p className="text-indigo-700 text-sm"><strong>Status:</strong><span className={`ml-1 font-semibold ${customer.currentMembership.status === 'Active' ? 'text-green-600' : 'text-gray-600'}`}>{customer.currentMembership.status}</span></p><p className="text-xs text-indigo-500 mt-1"><strong>Valid:</strong> {formatDate(customer.currentMembership.startDate)} to {formatDate(customer.currentMembership.endDate)}</p></div>
//                   ) : (
//                     <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-center"><p className="text-gray-500 text-sm mb-2">No active membership.</p><button onClick={handleAddMembershipClick} className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">+ Add Membership</button></div>
//                   )}
//               </div>

//               {/* LOYALTY POINTS SECTION (Correct) */}
//               <hr className="mx-6 my-4 border-gray-200"/>
//               <div className="px-6 pb-4">
//                   <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2"><GiftIcon className="w-5 h-5 text-indigo-600"/> Loyalty Program</h4>
//                   <div className="bg-indigo-50 p-4 rounded-lg mb-4 text-center"><p className="text-sm font-medium text-indigo-800">Current Point Balance</p><p className="text-4xl font-bold text-indigo-900">{customer.loyaltyPoints ?? 0}</p></div>
//                   <form onSubmit={handleAdjustPoints} className="space-y-3 p-4 border rounded-lg bg-gray-50/70"><h5 className="font-medium text-gray-700">Adjust Points</h5>{adjustmentError && <div className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{adjustmentError}</div>}<div className="flex gap-2"><input type="number" placeholder="+50 or -20" value={pointsToAdjust} onChange={e => setPointsToAdjust(e.target.value)} className="w-28 px-2 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm" required /><input type="text" placeholder="Reason (e.g., Birthday bonus)" value={adjustmentReason} onChange={e => setAdjustmentReason(e.target.value)} className="flex-grow px-2 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm" required /></div><button type="submit" disabled={isAdjustingPoints} className="w-full bg-black text-white text-sm font-medium py-2 rounded-md hover:bg-gray-800 disabled:bg-gray-400">{isAdjustingPoints ? 'Submitting...' : 'Submit Adjustment'}</button></form>
//                   {customer.loyaltyHistory && customer.loyaltyHistory.length > 0 && <div className="mt-6"><h5 className="text-sm font-medium text-gray-500 mb-2">Recent History</h5><ul className="divide-y divide-gray-200 border rounded-lg max-h-60 overflow-y-auto">{customer.loyaltyHistory.map(log => <li key={log.id} className="flex justify-between items-center p-3 text-sm bg-white"><div><p className={`font-semibold ${log.type === 'Credit' ? 'text-green-600' : 'text-red-600'}`}>{log.type === 'Credit' ? `+${log.points}` : `-${log.points}`}</p><p className="text-gray-600">{log.reason}</p></div><p className="text-xs text-gray-400">{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : ''}</p></li>)}</ul></div>}
//               </div>

//               <hr className="mx-6 my-4 border-gray-200"/>

//               {/* ===> APPOINTMENT HISTORY SECTION (RESTORED) <=== */}
//               <div className="px-6 pb-6 flex-grow">
//                   <h4 className="text-lg font-semibold text-gray-800 mb-3 sticky top-0 bg-white pt-2 pb-3 z-10 border-b border-gray-200 -mx-6 px-6">Appointment History ({customer.appointmentHistory?.length || 0})</h4>
//                   {(!customer.appointmentHistory || customer.appointmentHistory.length === 0) ? <p className="text-gray-500 text-sm py-4 text-center">No appointments found.</p> :
//                       <ul className="space-y-3 text-sm">{customer.appointmentHistory.map(apt => (
//                           <li key={apt.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 shadow-sm"><div className="flex justify-between items-start mb-1"><p className="font-semibold text-gray-800">{apt.service}</p><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${apt.status === 'Completed' ? 'bg-green-100 text-green-700' : apt.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{apt.status}</span></div><p className="text-gray-600 text-xs">{formatDate(apt.date)} at {formatTime(apt.time)}</p>{apt.stylist && <p className="text-gray-600 text-xs mt-0.5">With: {apt.stylist}</p>}</li>
//                       ))}</ul>
//                   }
//               </div>
//           </div>
//         </div>
//       ) : (
//          <div className="p-6 h-full flex flex-col items-center justify-center"><div className="flex justify-end w-full absolute top-0 right-0 p-6"><button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100" aria-label="Close panel"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div><p className="text-gray-500">Loading customer details...</p></div>
//       )}
//     </div>
//   );
// };

// export default CrmCustomerDetailPanel;