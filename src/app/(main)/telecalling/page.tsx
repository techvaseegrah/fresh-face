'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useTelecallingQueue } from './hooks/useTelecallingQueue';
import ClientFollowUpCard from './components/ClientFollowUpCard';
import ResponseActions from './components/ResponseActions';
import ScheduleCallbackModal from './components/ScheduleCallbackModal';
import ComplaintModal from './components/ComplaintModal';
import LoadingSpinner from '@/components/LoadingSpinner';
import BookAppointmentForm from '@/app/(main)/appointment/components/BookAppointmentForm/index';
import { Phone, CheckCircle, Percent, Settings } from 'lucide-react'; // 1. IMPORT Settings icon
import { hasAnyPermission, PERMISSIONS } from '@/lib/permissions';
import TelecallingSettingsModal from './components/TelecallingSettingsModal'; // 2. IMPORT the new settings modal

const StatCard = ({ icon, label, value, colorClass }: { icon: React.ReactNode; label: string; value: string | number; colorClass: string; }) => (
  <div className="bg-white p-4 rounded-lg shadow-md flex items-center space-x-3 border-l-4" style={{ borderColor: colorClass }}>
    <div className="p-2 rounded-full" style={{ backgroundColor: `${colorClass}20` }}>{icon}</div>
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

export default function TelecallingPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { currentClient, stats, isLoading, error, logAndProceed, queueCount } = useTelecallingQueue();

  // State for all modals
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // 3. ADD state for the settings modal

  const canPerformTelecalling = session && hasAnyPermission(session.user.role.permissions, [PERMISSIONS.TELECALLING_PERFORM, PERMISSIONS.TELECALLING_VIEW_DASHBOARD]);

  // Handler for booking an appointment, using the modern `useSession` hook
  const handleAppointmentBooked = useCallback(async (newAppointmentDataFromForm: any) => {
    if (!session?.user?.tenantId || !currentClient) {
      toast.error("Session or client data is missing.");
      return;
    }

    try {
      const finalAppointmentData = {
        ...newAppointmentDataFromForm,
        customerId: currentClient._id,
        appointmentType: 'Telecalling',
      };
      
      const response = await fetch('/api/appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': session.user.tenantId,
        },
        body: JSON.stringify(finalAppointmentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to book the appointment.');
      }

      const newAppointmentResponse = await response.json();
      await logAndProceed({
        outcome: 'Appointment Booked',
        appointmentId: newAppointmentResponse.appointment._id, 
      });

      toast.success('Appointment booked successfully!');
      setIsAppointmentModalOpen(false);

    } catch (err: any) {
      console.error("Booking failed:", err);
      toast.error(err.message);
    }
  }, [session, currentClient, logAndProceed]);
  
  // Loading, permission, and error states
  if (sessionStatus === 'loading' || isLoading) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
  }
  if (!canPerformTelecalling) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-center p-4">
        <h1 className="text-4xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-lg text-gray-700">You do not have the required permissions to view this page.</p>
      </div>
    );
  }
  if (error) {
    return <div className="text-center text-red-500 p-8">{error}</div>;
  }

  // Main component render
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-800">Client Follow-Up Workspace</h1>
              {/* 4. ADD the settings trigger button */}
              <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
                  title="Telecalling Settings"
              >
                  <Settings size={22} />
              </button>
            </div>
            <span className="text-lg font-semibold bg-blue-500 text-white py-2 px-4 rounded-lg">
              {queueCount} Clients in Queue
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={<Phone size={22} className="text-blue-500" />} label="Today's Calls" value={stats?.totalCalls ?? 0} colorClass="#3b82f6" />
            <StatCard icon={<CheckCircle size={22} className="text-green-500" />} label="Appointments Booked" value={stats?.appointmentsBooked ?? 0} colorClass="#22c55e" />
            <StatCard icon={<Percent size={22} className="text-purple-500" />} label="Conversion Rate" value={`${stats?.conversionRate ?? 0}%`} colorClass="#8b5cf6" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-xl p-6">
          {currentClient ? (
            <>
              <ClientFollowUpCard client={currentClient} />
              <hr className="my-6" />
              <ResponseActions
                onLog={logAndProceed}
                onOpenAppointmentModal={() => setIsAppointmentModalOpen(true)}
                onOpenCallbackModal={() => setIsCallbackModalOpen(true)}
                onOpenComplaintModal={() => setIsComplaintModalOpen(true)}
              />
            </>
          ) : (
            <div className="text-center py-16">
              <h2 className="text-2xl font-semibold text-gray-700">Queue is Empty!</h2>
              <p className="mt-2 text-gray-500">Great job, you've contacted everyone for now.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* RENDER all modals */}
      {currentClient && (
        <>
          <BookAppointmentForm
            isOpen={isAppointmentModalOpen}
            onClose={() => setIsAppointmentModalOpen(false)}
            onBookAppointment={handleAppointmentBooked}
          />
          <ScheduleCallbackModal
            isOpen={isCallbackModalOpen}
            onClose={() => setIsCallbackModalOpen(false)}
            onSchedule={logAndProceed}
          />
          <ComplaintModal
            isOpen={isComplaintModalOpen}
            onClose={() => setIsComplaintModalOpen(false)}
            onLogComplaint={logAndProceed}
          />
        </>
      )}
      {/* 5. RENDER the new settings modal */}
      <TelecallingSettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}