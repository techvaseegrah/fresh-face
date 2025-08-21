'use client';

import { useState, useCallback } from 'react'; // 1. IMPORT useCallback
import { useSession, getSession } from 'next-auth/react'; // 2. IMPORT getSession
import { toast } from 'react-toastify';
import { useTelecallingQueue } from './hooks/useTelecallingQueue';
import ClientFollowUpCard from './components/ClientFollowUpCard';
import ResponseActions from './components/ResponseActions';
import ScheduleCallbackModal from './components/ScheduleCallbackModal';
import ComplaintModal from './components/ComplaintModal';
import LoadingSpinner from '@/components/LoadingSpinner';
import BookAppointmentForm from '@/app/(main)/appointment/BookAppointmentForm';
import { Phone, CheckCircle, Percent } from 'lucide-react';
import { hasAnyPermission, PERMISSIONS } from '@/lib/permissions';

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

  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);

  const canPerformTelecalling = session && hasAnyPermission(session.user.role.permissions, [PERMISSIONS.TELECALLING_PERFORM, PERMISSIONS.TELECALLING_VIEW_DASHBOARD]);

  // 3. ADD THE tenantFetch HELPER FUNCTION (from your reference)
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentSession = await getSession(); 
    if (!currentSession?.user?.tenantId) {
      toast.error("Session error: Tenant not found. Please log in again.");
      throw new Error("Missing tenant ID in session");
    }
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      'x-tenant-id': currentSession.user.tenantId,
    };
    return fetch(url, { ...options, headers });
  }, []);
  // ----------------------------------------------------------------------

  const handleAppointmentBooked = async (newAppointmentDataFromForm: any) => {
    try {
        const finalAppointmentData = {
      ...newAppointmentDataFromForm, // This will contain { status: 'Appointment' } from the form
      appointmentType: 'Telecalling' // We ADD the origin information here
    };
      // 4. USE tenantFetch INSTEAD OF THE STANDARD fetch
      const response = await tenantFetch('/api/appointment', {
        method: 'POST',
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
  };
  
  // ... (the rest of your component logic and JSX remains unchanged)
  if (sessionStatus === 'loading' || isLoading) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
  }

  if (!canPerformTelecalling) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-center p-4">
        <h1 className="text-4xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-lg text-gray-700">You do not have the required permissions to view this page.</p>
        <p className="mt-4 text-sm text-gray-500">Please contact your administrator if you believe this is an error.</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 p-8">{error}</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800">Client Follow-Up Workspace</h1>
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
    </div>
  );
}