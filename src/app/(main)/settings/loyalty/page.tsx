'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

interface LoyaltySettings {
  rupeesForPoints: number;
  pointsAwarded: number;
}

export default function LoyaltySettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<LoyaltySettings>({ rupeesForPoints: 100, pointsAwarded: 6 });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canViewLoyaltySettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.LOYALTY_SETTINGS_READ);
  const canUpdateLoyaltySettings = hasPermission(session?.user?.role?.permissions || [], PERMISSIONS.LOYALTY_SETTINGS_UPDATE);

  // Fetch current settings when the page loads
  useEffect(() => {
    if (canViewLoyaltySettings) {
      const fetchSettings = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/api/settings/loyalty');
          const data = await response.json();
          if (data.success) {
            setSettings(data.settings);
          } else {
            setMessage({ type: 'error', text: 'Failed to load settings.' });
          }
        } catch (error) {
          setMessage({ type: 'error', text: 'An error occurred while loading settings.' });
        } finally {
          setIsLoading(false);
        }
      };
      fetchSettings();
    } else {
      setIsLoading(false);
    }
  }, [canViewLoyaltySettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: Number(value)
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canUpdateLoyaltySettings) {
        setMessage({ type: 'error', text: 'You do not have permission to update loyalty settings.' });
        return;
    }
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/loyalty', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
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

  if (!canViewLoyaltySettings) {
      return (
          <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-md">
              <h1 className="text-2xl font-bold mb-4 text-red-600">Access Denied</h1>
              <p className="text-gray-600">You do not have the required permissions to view loyalty settings.</p>
          </div>
      );
  }

  if (isLoading && !settings.rupeesForPoints) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-md">
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
              disabled={!canUpdateLoyaltySettings}
            />
            <p className="text-xs text-gray-500 mt-1">Award points for every specified amount spent.</p>
          </div>

          <p className="text-center text-gray-800 font-semibold p-3 bg-gray-100 rounded-md">
            Current Rule: Award {settings.pointsAwarded} points for every ₹{settings.rupeesForPoints} spent.
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