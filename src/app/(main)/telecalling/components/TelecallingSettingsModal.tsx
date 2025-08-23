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
  const [days, setDays] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 1. --- STATE FOR SMOOTH ANIMATIONS ---
  // `isRendered` controls if the modal is in the DOM.
  // `showAnimation` controls the CSS classes for the fade/slide effect.
  const [isRendered, setIsRendered] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  // This useEffect manages the entire open/close animation lifecycle to prevent flickering.
  useEffect(() => {
    if (isOpen) {
      // To open: First, render the component (in a hidden state).
      setIsRendered(true);
      // Then, after a tiny delay, apply the animation classes to transition it into view.
      const openTimer = setTimeout(() => setShowAnimation(true), 10);
      return () => clearTimeout(openTimer);
    } else {
      // To close: First, apply animation classes to transition it out of view.
      setShowAnimation(false);
      // Then, after the animation finishes, remove it from the DOM completely.
      const closeTimer = setTimeout(() => setIsRendered(false), 200); // Duration matches CSS transition
      return () => clearTimeout(closeTimer);
    }
  }, [isOpen]);

  // This useEffect handles fetching the data. It runs only when the modal is actually rendered.
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

  // Handler for saving the settings.
  const handleSave = async () => {
    if (!session || days === null) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/telecalling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
        body: JSON.stringify({ telecallingDays: Number(days) }),
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

  // 2. --- RENDER LOGIC ---
  // The component only renders if `isRendered` is true.
  if (!isRendered) return null;

  return (
    // The backdrop's opacity is now controlled by `showAnimation` state.
    <div className={`fixed inset-0 bg-black flex justify-center items-center z-50 p-4 transition-opacity duration-200 ${showAnimation ? 'bg-opacity-60' : 'bg-opacity-0'}`}>
      
      {/* The modal box's transition is also controlled by `showAnimation` for a smooth fade, scale, and slide effect. */}
      <div className={`bg-white p-6 rounded-lg shadow-xl w-full max-w-lg flex flex-col min-h-[240px] transition-all duration-200 ${showAnimation ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Telecalling Queue Settings</h2>
        
        {/* This area correctly centers the content (spinner or form) */}
        <div className="flex-grow flex justify-center items-center">
          {isLoading ? <LoadingSpinner /> : (
            <div className="w-full">
              <p className="text-sm text-gray-600 mb-4">
                Configure the logic for when lapsed clients should be added to the follow-up queue.
              </p>
              <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-md">
                <label htmlFor="telecalling-days" className="text-sm font-medium text-gray-700">Add clients to queue after:</label>
                <input
                  id="telecalling-days"
                  type="number"
                  value={days ?? ''} 
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500"
                />
                <span className="text-gray-700">days of inactivity.</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
          <Button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || days === null}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}