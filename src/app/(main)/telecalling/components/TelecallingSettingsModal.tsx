'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/LoadingSpinner';

interface TelecallingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelecallingSettingsModal({ isOpen, onClose }: TelecallingSettingsModalProps) {
  const { data: session } = useSession();
  
  // --- STATE CHANGE: The state now holds an object for the range ---
  const [days, setDays] = useState<{ from: number; to: number } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  // This useEffect for animations remains unchanged.
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const openTimer = setTimeout(() => setShowAnimation(true), 10);
      return () => clearTimeout(openTimer);
    } else {
      setShowAnimation(false);
      const closeTimer = setTimeout(() => setIsRendered(false), 200);
      return () => clearTimeout(closeTimer);
    }
  }, [isOpen]);

  // --- DATA FETCHING: This now expects an object from the API ---
  useEffect(() => {
    if (isRendered && session) {
      setIsLoading(true);
      const controller = new AbortController();
      const fetchSettings = async () => {
        try {
          const response = await fetch('/api/settings/telecalling', {
            headers: { 'x-tenant-id': session.user.tenantId },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('Could not fetch settings');
          const data = await response.json();
          // The API now returns { telecallingDays: { from: 30, to: 60 } }
          setDays(data.telecallingDays);
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            toast.error("Could not load current settings.");
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        }
      };
      fetchSettings();
      return () => controller.abort();
    }
  }, [isRendered, session]);

  // --- DATA SAVING: This now sends the from/to object to the API ---
  const handleSave = async () => {
    if (!session || !days || days.from == null || days.to == null) return;
    
    // You can add validation here for a better user experience
    if (days.from >= days.to) {
        toast.error('"From" days must be less than "To" days.');
        return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/telecalling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
        // The body now sends `fromDays` and `toDays` as expected by the new API
        body: JSON.stringify({ fromDays: days.from, toDays: days.to }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to save settings.");
      }
      toast.success("Settings saved successfully! Changes will apply on the next queue refresh.");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isRendered) return null;

  return (
    <div className={`fixed inset-0 bg-black flex justify-center items-center z-50 p-4 transition-opacity duration-200 ${showAnimation ? 'bg-opacity-60' : 'bg-opacity-0'}`}>
      <div className={`bg-white p-6 rounded-lg shadow-xl w-full max-w-lg flex flex-col min-h-[240px] transition-all duration-200 ${showAnimation ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Telecalling Queue Settings</h2>
        
        <div className="flex-grow flex justify-center items-center">
          {isLoading ? <LoadingSpinner /> : (
            <div className="w-full">
              <p className="text-sm text-gray-600 mb-4">
                Add clients to the queue who haven't visited within a specific timeframe.
              </p>

              {/* === UI CHANGE: Two input fields for the range === */}
              <div className="flex items-center space-x-2 bg-gray-50 p-4 rounded-md">
                <label htmlFor="from-days" className="text-sm font-medium text-gray-700">From:</label>
                <input
                  id="from-days"
                  type="number"
                  value={days?.from ?? ''} 
                  onChange={(e) => setDays(prev => ({ ...prev!, from: Number(e.target.value) }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500"
                  placeholder="e.g., 30"
                />
                <label htmlFor="to-days" className="text-sm font-medium text-gray-700">To:</label>
                <input
                  id="to-days"
                  type="number"
                  value={days?.to ?? ''} 
                  onChange={(e) => setDays(prev => ({ ...prev!, to: Number(e.target.value) }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500"
                  placeholder="e.g., 60"
                />
                <span className="text-gray-700">days ago.</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
          <Button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || !days || days.from == null || days.to == null}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}