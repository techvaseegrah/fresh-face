// FILE: src/app/(main)/alerts/page.tsx - ENHANCED UI/UX VERSION

'use client';

import { useState, useEffect, FormEvent, FC, PropsWithChildren } from 'react';
import { useSession } from 'next-auth/react'; // Import useSession
import { hasPermission, PERMISSIONS } from '@/lib/permissions'; // Import hasPermission and PERMISSIONS
import { EnvelopeIcon, BellAlertIcon, AtSymbolIcon } from '@heroicons/react/24/outline';

// --- HELPER SUB-COMPONENTS (for a cleaner main component) ---

const XIcon: FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Toast: FC<{ message: string; show: boolean; isError: boolean }> = ({ message, show, isError }) => {
  if (!show) return null;
  const bgColor = isError ? 'bg-red-600' : 'bg-green-600';
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-white shadow-lg ${bgColor} transition-opacity duration-300 z-50`}>
      {message}
    </div>
  );
};

// A reusable card component for consistent styling
const SettingsCard: FC<PropsWithChildren<{ title: string; description: string; icon: React.ReactNode; formProps: any }>> = ({ title, description, icon, formProps, children }) => (
  <form {...formProps} className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
    <div className="p-6">
      <div className="flex items-center gap-3">
        <div className="bg-gray-100 p-2 rounded-lg">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      <div className="mt-6 border-t border-gray-200 pt-6">
        {children}
      </div>
    </div>
  </form>
);

// --- MAIN ALERTS PAGE COMPONENT ---
export default function AlertsPage() {
  const { data: session } = useSession(); // Get session data
  const userPermissions = session?.user?.role?.permissions || [];

  // Define permissions for the page
  const canReadAlerts = hasPermission(userPermissions, PERMISSIONS.ALERTS_READ);
  const canCreateAlerts = hasPermission(userPermissions, PERMISSIONS.ALERTS_CREATE);
  const canDeleteAlerts = hasPermission(userPermissions, PERMISSIONS.ALERTS_DELETE);

  // --- All of your state and logic functions are perfect and remain unchanged ---
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState({ message: '', show: false, isError: false });
  const [dayEndRecipients, setDayEndRecipients] = useState<string[]>([]);
  const [newDayEndRecipient, setNewDayEndRecipient] = useState('');
  const [isDayEndSaving, setIsDayEndSaving] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [lowStockRecipients, setLowStockRecipients] = useState<string[]>([]);
  const [newLowStockRecipient, setNewLowStockRecipient] = useState('');
  const [isLowStockSaving, setIsLowStockSaving] = useState(false);

  useEffect(() => {
    if (canReadAlerts) {
        const fetchAllSettings = async () => {
        setIsLoading(true);
        try {
            const [dayEndRes, thresholdRes, lowStockRecipientsRes] = await Promise.all([
            fetch('/api/settings/dayEndReportRecipients'),
            fetch('/api/settings/globalLowStockThreshold'),
            fetch('/api/settings/inventoryAlertRecipients')
            ]);
            const dayEndData = await dayEndRes.json();
            const thresholdData = await thresholdRes.json();
            const lowStockRecipientsData = await lowStockRecipientsRes.json();
            if (dayEndData.success) setDayEndRecipients(dayEndData.setting.value || []);
            if (thresholdData.success) setLowStockThreshold(thresholdData.setting.value || '10');
            if (lowStockRecipientsData.success) setLowStockRecipients(lowStockRecipientsData.setting.value || []);
        } catch (error) {
            console.error("Error fetching settings:", error);
            showToast("Failed to load settings from server.", true);
        } finally {
            setIsLoading(false);
        }
        };
        fetchAllSettings();
    } else {
        setIsLoading(false);
    }
  }, [canReadAlerts]);

  const showToast = (message: string, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => setToast({ message: '', show: false, isError: false }), 3000);
  };

  const handleAddDayEndEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(newDayEndRecipient)) { showToast("Please enter a valid email.", true); return; }
    if (dayEndRecipients.includes(newDayEndRecipient)) { showToast("This email is already added.", true); return; }
    setDayEndRecipients([...dayEndRecipients, newDayEndRecipient]);
    setNewDayEndRecipient('');
  };
  const handleRemoveDayEndEmail = (email: string) => setDayEndRecipients(dayEndRecipients.filter(e => e !== email));
  const handleSaveDayEndSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsDayEndSaving(true);
    try {
      const res = await fetch('/api/settings/dayEndReportRecipients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: dayEndRecipients }), });
      const data = await res.json();
      data.success ? showToast("Day-End settings saved!") : showToast(data.message || 'An error occurred', true);
    } catch (error) {
      showToast("An error occurred while saving.", true);
    } finally {
      setIsDayEndSaving(false);
    }
  };

  const handleAddLowStockEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(newLowStockRecipient)) { showToast("Please enter a valid email.", true); return; }
    if (lowStockRecipients.includes(newLowStockRecipient)) { showToast("This email is already added.", true); return; }
    setLowStockRecipients([...lowStockRecipients, newLowStockRecipient]);
    setNewLowStockRecipient('');
  };
  const handleRemoveLowStockEmail = (email: string) => setLowStockRecipients(lowStockRecipients.filter(e => e !== email));
  const handleSaveLowStockSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsLowStockSaving(true);
    try {
      const [thresholdRes, recipientsRes] = await Promise.all([
        fetch('/api/settings/globalLowStockThreshold', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: lowStockThreshold }), }),
        fetch('/api/settings/inventoryAlertRecipients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: lowStockRecipients }), })
      ]);
      (thresholdRes.ok && recipientsRes.ok)
        ? showToast("Low stock settings saved successfully!")
        : showToast("Failed to save one or more low stock settings.", true);
    } catch (error) {
      showToast("An error occurred while saving.", true);
    } finally {
      setIsLowStockSaving(false);
    }
  };
  // --- END OF LOGIC ---

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Loading Alert Settings...</div>;
  }

  if (!canReadAlerts) {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-gray-600">You do not have permission to view alert settings.</p>
        </div>
    );
  }
  
  return (
    <>
      <div className="p-4 sm:p-8 bg-gray-50 min-h-full">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Alert Management</h1>
            <p className="mt-2 text-md text-gray-500">Configure who gets notified about important events and when.</p>
          </div>
          
          <div className="space-y-10">
            {/* --- Card 1: Day-End Summary Report --- */}
            <SettingsCard 
              title="Day-End Summary Report"
              description="Add email addresses to receive the daily closing report."
              icon={<EnvelopeIcon className="h-6 w-6 text-gray-600" />}
              formProps={{ onSubmit: handleSaveDayEndSettings }}
            >
              <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-grow">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><AtSymbolIcon className="h-5 w-5 text-gray-400" /></div>
                  <input type="email" value={newDayEndRecipient} onChange={(e) => setNewDayEndRecipient(e.target.value)} placeholder="manager@example.com" className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" disabled={!canCreateAlerts} />
                </div>
                <button type="button" onClick={handleAddDayEndEmail} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors" disabled={!canCreateAlerts}>Add</button>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 min-h-[50px]">
                {dayEndRecipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {dayEndRecipients.map((email) => (
                      <span key={email} className="inline-flex items-center gap-x-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 border border-gray-200">
                        {email}
                        {canDeleteAlerts && (
                            <button type="button" onClick={() => handleRemoveDayEndEmail(email)} className="-mr-1 h-5 w-5 p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full"><XIcon /></button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : ( <p className="text-sm text-gray-400 text-center py-2">No recipients added yet.</p> )}
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" disabled={isDayEndSaving || !canCreateAlerts} className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-gray-800 disabled:bg-gray-400 transition-colors">{isDayEndSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </SettingsCard>

            {/* --- Card 2: Low Stock Alert Section --- */}
            <SettingsCard 
              title="Low Stock Alerts"
              description="Configure the global threshold and email recipients."
              icon={<BellAlertIcon className="h-6 w-6 text-gray-600" />}
              formProps={{ onSubmit: handleSaveLowStockSettings }}
            >
              <div className="grid grid-cols-1 gap-y-6">
                <div>
                  <label htmlFor="low-stock-threshold" className="block text-sm font-medium text-gray-700 mb-2">Global Low Stock Threshold</label>
                  <input id="low-stock-threshold" type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} placeholder="e.g., 10" className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required disabled={!canCreateAlerts} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alert Recipients</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-grow">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><AtSymbolIcon className="h-5 w-5 text-gray-400" /></div>
                      <input type="email" value={newLowStockRecipient} onChange={(e) => setNewLowStockRecipient(e.target.value)} placeholder="procurement@example.com" className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" disabled={!canCreateAlerts} />
                    </div>
                    <button type="button" onClick={handleAddLowStockEmail} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors" disabled={!canCreateAlerts}>Add</button>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 min-h-[50px]">
                    {lowStockRecipients.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {lowStockRecipients.map((email) => (
                          <span key={email} className="inline-flex items-center gap-x-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 border border-gray-200">
                            {email}
                            {canDeleteAlerts && (
                                <button type="button" onClick={() => handleRemoveLowStockEmail(email)} className="-mr-1 h-5 w-5 p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full"><XIcon /></button>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : ( <p className="text-sm text-gray-400 text-center py-2">No recipients added yet.</p> )}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button type="submit" disabled={isLowStockSaving || !canCreateAlerts} className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-gray-800 disabled:bg-gray-400 transition-colors">{isLowStockSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </SettingsCard>
          </div>
        </div>
      </div>
      <Toast message={toast.message} show={toast.show} isError={toast.isError} />
    </>
  );
}