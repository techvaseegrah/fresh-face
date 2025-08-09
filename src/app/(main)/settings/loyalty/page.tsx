'use client';

import { useState, useEffect, FormEvent, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Interface allows number or an empty string for controlled inputs
interface LoyaltySettings {
  rupeesForPoints: number | '';
  pointsAwarded: number | '';
}

export default function LoyaltySettingsPage() {
  const { data: session } = useSession();
  // TENANT-AWARE: Get tenantId from the session
  const tenantId = useMemo(() => session?.user?.tenantId, [session]);
  
  const [settings, setSettings] = useState<LoyaltySettings>({ rupeesForPoints: '', pointsAwarded: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canViewLoyaltySettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.LOYALTY_SETTINGS_READ);
  const canUpdateLoyaltySettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.LOYALTY_SETTINGS_UPDATE);

  // TENANT-AWARE: Create a centralized fetch wrapper
  const tenantAwareFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!tenantId) {
      throw new Error("Your session is missing tenant information. Please log out and log back in.");
    }
    const headers = new Headers(options.headers || {});
    headers.set('x-tenant-id', tenantId);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...options, headers });
  }, [tenantId]);


  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        // TENANT-AWARE: Use the tenant-aware wrapper
        const response = await tenantAwareFetch('/api/settings/loyalty');
        const data = await response.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
        } else {
          setMessage({ type: 'error', text: data.message || 'Failed to load settings.' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'An error occurred while loading settings.' });
      } finally {
        setIsLoading(false);
      }
    };
    
    // TENANT-AWARE: Guard the fetch until tenantId and permissions are available
    if (canViewLoyaltySettings && tenantId) {
      fetchSettings();
    } else {
      setIsLoading(false);
    }
  }, [canViewLoyaltySettings, tenantId, tenantAwareFetch]); // Add dependencies

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canUpdateLoyaltySettings) {
        setMessage({ type: 'error', text: 'You do not have permission to update loyalty settings.' });
        return;
    }

    if (settings.rupeesForPoints === '' || settings.pointsAwarded === '') {
        setMessage({ type: 'error', text: 'Both fields are required.' });
        return;
    }

    setIsLoading(true);
    setMessage(null);

    const payload = {
      rupeesForPoints: Number(settings.rupeesForPoints),
      pointsAwarded: Number(settings.pointsAwarded),
    };

    try {
      // TENANT-AWARE: Use the tenant-aware wrapper
      const response = await tenantAwareFetch('/api/settings/loyalty', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save settings.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!canViewLoyaltySettings && !isLoading) {
      return (
          <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-md">
              <h1 className="text-2xl font-bold mb-4 text-red-600">Access Denied</h1>
              <p className="text-gray-600">You do not have the required permissions to view loyalty settings.</p>
          </div>
      );
  }
  
  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl  bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Loyalty Point Management</h1>
      <p className="text-gray-600 mb-6">Define the rules for how customers earn loyalty points.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="pointsAwarded" className="block text-sm font-medium text-gray-700">
              Points Awarded
            </label>
            <input
              type="number"
              id="pointsAwarded"
              name="pointsAwarded"
              value={settings.pointsAwarded}
              onChange={handleInputChange}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              required
              min="0"
              disabled={!canUpdateLoyaltySettings}
            />
            <p className="text-xs text-gray-500 mt-1">The number of points to award.</p>
          </div>
          
          <div>
            <label htmlFor="rupeesForPoints" className="block text-sm font-medium text-gray-700">
              For Every (Rupees)
            </label>
            <input
              type="number"
              id="rupeesForPoints"
              name="rupeesForPoints"
              value={settings.rupeesForPoints}
              onChange={handleInputChange}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              required
              min="1"
              disabled={!canUpdateLoyaltySettings}
            />
            <p className="text-xs text-gray-500 mt-1">Award points for every specified amount spent.</p>
          </div>

          <p className="text-center text-gray-800 font-semibold p-3 bg-gray-100 rounded-md">
            Current Rule: Award {Number(settings.pointsAwarded) || 0} points for every ₹{Number(settings.rupeesForPoints) || 0} spent.
          </p>
        </div>
        
        <div className="mt-6">
          <button
            type="submit"
            disabled={isLoading || !canUpdateLoyaltySettings}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
      
      {message && (
        <div className={`mt-4 p-3 rounded-md text-center ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}