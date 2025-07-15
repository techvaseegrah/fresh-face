"use client";

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Briefcase, Clock, AlertCircle } from 'lucide-react';
import Button from '../../../../components/ui/Button';

interface PositionHourSetting {
  positionName: string;
  requiredHours: number;
}

const PositionHoursSettingsPage: React.FC = () => {
  const router = useRouter();
  const [settings, setSettings] = useState<PositionHourSetting[]>([]);
  const [initialSettings, setInitialSettings] = useState<PositionHourSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/settings/position-hours');
        if (!response.ok) {
          throw new Error('Failed to fetch settings from the server.');
        }
        const result = await response.json();
        if (result.success) {
          setSettings(result.data);
          setInitialSettings(JSON.parse(JSON.stringify(result.data)));
        } else {
          throw new Error(result.error || 'Could not retrieve settings.');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleHourChange = (e: ChangeEvent<HTMLInputElement>, positionName: string) => {
    const newHours = e.target.value === '' ? 0 : parseFloat(e.target.value);
    setSettings(currentSettings =>
      currentSettings.map(setting =>
        setting.positionName === positionName
          ? { ...setting, requiredHours: isNaN(newHours) ? 0 : newHours }
          : setting
      )
    );
  };
  
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/settings/position-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save settings.');
      }
      
      setSuccessMessage('Settings saved successfully!');
      setInitialSettings(JSON.parse(JSON.stringify(settings)));
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any)      {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => router.back()} className="mr-4">Back</Button>
          {/* --- MODIFICATION: Updated Title --- */}
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Monthly Position Hours</h1>
        </div>
        <Button 
          variant="black" 
          icon={<Save size={16} />} 
          onClick={handleSave}
          disabled={isSaving || !hasChanges || isLoading}
          isLoading={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      {successMessage && (
         <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert">
          <p>{successMessage}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="border-b pb-4 mb-4">
            {/* --- MODIFICATION: Updated Header & Description --- */}
            <h2 className="text-lg font-semibold text-gray-900">Manage Monthly Hours by Position</h2>
            <p className="text-sm text-gray-500 mt-1">Set the default required **monthly** working hours for each staff position. This will be used in attendance calculations.</p>
          </div>

          {isLoading ? (
            <p className="text-center text-gray-500 py-8">Loading positions...</p>
          ) : settings.length === 0 ? (
            <div className="text-center py-10 px-6 bg-gray-50 rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Positions Found</h3>
                <p className="mt-1 text-sm text-gray-500">Add a new staff member to create a position.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {settings.map(({ positionName, requiredHours }) => (
                <div key={positionName} className="flex items-center justify-between gap-4 p-3 rounded-md border">
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-gray-500" />
                    <span className="font-medium text-gray-800">{positionName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <Clock className="h-4 w-4 text-gray-400" />
                     <input
                      type="number"
                      value={requiredHours}
                      onChange={(e) => handleHourChange(e, positionName)}
                      min="0"
                      // --- MODIFICATION: Changed step for larger numbers ---
                      step="1"
                      className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-right text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100"
                      disabled={isSaving}
                    />
                    {/* --- MODIFICATION: Updated Label --- */}
                    <span className="text-sm text-gray-600">hours/month</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PositionHoursSettingsPage;