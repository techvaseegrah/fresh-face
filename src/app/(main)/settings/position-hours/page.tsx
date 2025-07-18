"use client";

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Briefcase, Clock, AlertCircle, Loader2 } from 'lucide-react';
import Button from '../../../../components/ui/Button'; // Assuming this is your custom button

interface PositionHourSetting {
  positionName: string;
  requiredHours: number;
}

// --- Reusable UI Components (inspired by your reference) ---
const InputField = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-28 rounded-md border-gray-300 bg-white px-3 py-2 text-right text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed"
  />
);

const InfoCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-lg shadow-sm p-8 text-center border">
    {children}
  </div>
);

// --- Main Page Component ---
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
        // Simulate a slightly longer fetch for demo purposes
        await new Promise(resolve => setTimeout(resolve, 500)); 
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <InfoCard>
          <Loader2 className="mx-auto h-10 w-10 text-gray-400 animate-spin" />
          <p className="mt-4 text-sm font-medium text-gray-700">Loading Position Settings...</p>
        </InfoCard>
      );
    }

    if (settings.length === 0) {
      return (
        <InfoCard>
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No Positions Found</h3>
          <p className="mt-2 text-sm text-gray-500">
            You can add new positions by creating a new staff member in the staff management section.
          </p>
        </InfoCard>
      );
    }

    return (
      <div className="space-y-4">
        {settings.map(({ positionName, requiredHours }) => (
          <div 
            key={positionName} 
            className="bg-white p-4 rounded-lg shadow-sm border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-shadow hover:shadow-md"
          >
            {/* Left Side: Position Info */}
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 bg-gray-100 p-3 rounded-full">
                <Briefcase className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="font-semibold text-base text-gray-800">{positionName}</p>
                <p className="text-sm text-gray-500">Required monthly work hours</p>
              </div>
            </div>

            {/* Right Side: Input Control */}
            <div className="flex items-center gap-3 justify-end sm:justify-center">
              <Clock className="h-5 w-5 text-gray-400" />
              <InputField
                type="number"
                value={requiredHours}
                onChange={(e) => handleHourChange(e, positionName)}
                min="0"
                step="1"
                disabled={isSaving}
              />
              <span className="text-sm text-gray-600 font-medium">hours/month</span>
            </div>
          </div>
        ))}
      </div>
    );
  };


  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* --- Header Bar --- */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-8">
          <div className="flex items-center mb-4 sm:mb-0">
            <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => router.back()} className="mr-4">
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Monthly Position Hours</h1>
              <p className="text-sm text-gray-500 mt-1">Set the default required hours for each position.</p>
            </div>
          </div>
          <Button 
            variant="black" 
            icon={<Save size={16} />} 
            onClick={handleSave}
            disabled={isSaving || !hasChanges || isLoading}
            isLoading={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </header>
        
        {/* --- Alerts --- */}
        <div className="space-y-4 mb-6">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-r-md flex items-start gap-3" role="alert">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error Occurred</p>
                <p>{error}</p>
              </div>
            </div>
          )}
          {successMessage && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-r-md" role="alert">
              <p>{successMessage}</p>
            </div>
          )}
        </div>

        {/* --- Main Content Area --- */}
        <main>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default PositionHoursSettingsPage;