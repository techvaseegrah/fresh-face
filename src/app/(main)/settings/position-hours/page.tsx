'use client';

import React, { useState, useEffect, ChangeEvent, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  Briefcase, 
  Clock, 
  AlertCircle, 
  Loader2, 
  Info 
} from 'lucide-react';
import Button from '../../../../components/ui/Button';
// TENANT-AWARE: Import useSession to get the tenant ID
import { useSession } from 'next-auth/react';

// --- Data Interface ---
interface PositionHourSetting {
  positionName: string;
  requiredHours: number | ''; 
}

// --- Reusable UI Components (Mobile Responsive) ---
const PositionCard = ({ 
  positionName, 
  requiredHours, 
  onHourChange, 
  isSaving 
}: { 
  positionName: string; 
  requiredHours: number | ''; 
  onHourChange: (e: ChangeEvent<HTMLInputElement>) => void; 
  isSaving: boolean;
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out hover:shadow-md flex flex-col">
    <div className="border-t-4 border-green-500"></div>
    <div className="p-4 md:p-6 flex-grow">
      <div className="flex items-start gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="flex-shrink-0 bg-green-100 p-2 md:p-3 rounded-full">
          <Briefcase className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-base md:text-lg text-gray-800 leading-tight">{positionName}</h3>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Required monthly hours</p>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3 md:p-4">
        <label htmlFor={`hours-${positionName}`} className="block text-sm font-semibold text-gray-700 mb-2">
          Set Hours
        </label>
        <div className="flex items-center gap-2 md:gap-3">
          <Clock className="h-4 w-4 md:h-5 md:w-5 text-gray-400 flex-shrink-0" />
          <input
            id={`hours-${positionName}`}
            type="number"
            value={requiredHours} 
            onChange={onHourChange}
            min="0"
            placeholder="Enter hours"
            step="1"
            disabled={isSaving}
            className="w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-3 md:py-2 text-right text-base md:text-lg font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 disabled:bg-gray-200 disabled:cursor-not-allowed"
          />
          <span className="text-xs md:text-sm text-gray-500 font-medium whitespace-nowrap flex-shrink-0">/ month</span>
        </div>
      </div>
    </div>
  </div>
);

const StateInfoCard = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
  <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 text-center">
    <div className="mx-auto h-12 w-12 md:h-14 md:w-14 flex items-center justify-center rounded-full bg-gray-100 text-gray-400">
        {icon}
    </div>
    <h3 className="mt-4 md:mt-5 text-lg md:text-xl font-semibold text-gray-900">{title}</h3>
    <div className="mt-2 text-sm md:text-base text-gray-500">
      {children}
    </div>
  </div>
);


// --- Main Page Component (Tenant-Aware) ---
const PositionHoursSettingsPage: React.FC = () => {
  const router = useRouter();
  // TENANT-AWARE: Get session to extract tenantId
  const { data: session } = useSession();
  const tenantId = useMemo(() => session?.user?.tenantId, [session]);

  const [settings, setSettings] = useState<PositionHourSetting[]>([]);
  const [initialSettings, setInitialSettings] = useState<PositionHourSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // TENANT-AWARE: Guard the initial fetch until tenantId is available
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); 
        // Use the tenant-aware wrapper
        const response = await tenantAwareFetch('/api/settings/position-hours');
        if (!response.ok) throw new Error('Failed to fetch settings from the server.');
        
        const result = await response.json();
        if (result.success) {
          const sortedData = result.data.sort((a: any, b: any) => a.positionName.localeCompare(b.positionName));
          setSettings(sortedData);
          setInitialSettings(JSON.parse(JSON.stringify(sortedData)));
        } else {
          throw new Error(result.error || 'Could not retrieve settings.');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (tenantId) {
        fetchSettings();
    }
  }, [tenantId, tenantAwareFetch]); // Add dependencies

  const handleHourChange = (e: ChangeEvent<HTMLInputElement>, positionName: string) => {
    const value = e.target.value;
    setSettings(currentSettings =>
      currentSettings.map(setting => {
        if (setting.positionName === positionName) {
          return { ...setting, requiredHours: value === '' ? '' : Number(value) };
        }
        return setting;
      })
    );
  };
  
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const settingsToSave = settings.map(setting => ({
        ...setting,
        requiredHours: setting.requiredHours === '' ? 0 : setting.requiredHours,
      }));

      // TENANT-AWARE: Use the tenant-aware wrapper
      const response = await tenantAwareFetch('/api/settings/position-hours', {
        method: 'POST',
        body: JSON.stringify(settingsToSave),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save settings.');
      }
      
      setSettings(settingsToSave);
      setInitialSettings(JSON.parse(JSON.stringify(settingsToSave)));

    } catch (err: any)      {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDiscard = () => {
    setSettings(JSON.parse(JSON.stringify(initialSettings)));
    setError(null);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <StateInfoCard icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Loading Settings...">
          <p>Fetching the latest position hour configurations.</p>
        </StateInfoCard>
      );
    }

    if (error) {
      return (
        <StateInfoCard icon={<AlertCircle className="h-8 w-8 text-red-500" />} title="An Error Occurred">
            <p className="text-red-600">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
                Try Again
            </Button>
        </StateInfoCard>
      );
    }

    if (settings.length === 0) {
      return (
        <StateInfoCard icon={<Briefcase className="h-8 w-8" />} title="No Positions Found">
          <p>
            You can add new positions through the staff management section.
          </p>
        </StateInfoCard>
      );
    }

    return settings.map((setting) => (
      <PositionCard
        key={setting.positionName}
        positionName={setting.positionName}
        requiredHours={setting.requiredHours}
        onHourChange={(e) => handleHourChange(e, setting.positionName)}
        isSaving={isSaving}
      />
    ));
  };


  return (
    <div className="bg-gray-50 min-h-screen pb-20 md:pb-32">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-8">
        {/* Mobile and Desktop Header */}
        <header className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 mb-6 md:mb-8 pb-4 md:pb-6 border-b border-gray-200">
            <Button 
              variant="outline" 
              icon={<ArrowLeft size={16} />} 
              onClick={() => router.back()} 
              className="w-full sm:w-auto sm:mr-4 md:mr-5 min-h-[44px]"
            >
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight leading-tight">Monthly Position Hours</h1>
              <p className="text-sm md:text-base text-gray-500 mt-1">Set the default required work hours for each staff position.</p>
            </div>
        </header>

        {/* Mobile: Single column, Desktop: Grid layout */}
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {renderContent()}
        </main>
      </div>

      {/* Mobile Responsive Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto p-3 sm:p-4">
            {/* Mobile Layout */}
            <div className="md:hidden space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-gray-800">You have unsaved changes.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleDiscard} 
                  disabled={isSaving}
                  className="w-full min-h-[44px]"
                >
                  Discard
                </Button>
                <Button 
                  variant="black" 
                  icon={<Save size={16} />} 
                  onClick={handleSave}
                  disabled={isSaving}
                  isLoading={isSaving}
                  className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 focus:ring-green-500"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
            
            {/* Desktop Layout */}
            <div className="hidden md:flex md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-6 w-6 text-green-600" />
                <p className="font-semibold text-gray-800">You have unsaved changes.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleDiscard} disabled={isSaving}>
                  Discard
                </Button>
                <Button 
                  variant="black" 
                  icon={<Save size={16} />} 
                  onClick={handleSave}
                  disabled={isSaving}
                  isLoading={isSaving}
                  className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionHoursSettingsPage;