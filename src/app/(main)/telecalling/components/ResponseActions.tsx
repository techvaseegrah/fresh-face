// src/app/(main)/telecalling/components/ResponseActions.tsx
'use client';

import Button from '@/components/ui/Button'; // Assuming you have a reusable Button component
import {
  Check,
  Clock,
  X,
  PhoneOff,
  PowerOff,
  Phone,
  CalendarPlus,
  MessageSquareWarning,
} from 'lucide-react';

interface Props {
  onLog: (data: { outcome: string; notes?: string }) => void;
  onOpenAppointmentModal: () => void;
  onOpenCallbackModal: () => void;
  onOpenComplaintModal: () => void;
}

// A helper component for consistent button styling
const ActionButton = ({ icon, label, colorClass, onClick }: { icon: React.ReactNode; label: string; colorClass: string; onClick: () => void; }) => (
  <Button
    onClick={onClick}
    className={`w-full h-full flex flex-col sm:flex-row items-center justify-center p-3 text-white rounded-lg shadow-md transition-transform transform hover:scale-105 ${colorClass}`}
  >
    {icon}
    <span className="mt-2 sm:mt-0 sm:ml-3 font-semibold text-center">{label}</span>
  </Button>
);

export default function ResponseActions({
  onLog,
  onOpenAppointmentModal,
  onOpenCallbackModal,
  onOpenComplaintModal,
}: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <ActionButton
        icon={<Check size={24} />}
        label="Appointment Booked"
        colorClass="bg-green-500 hover:bg-green-600"
        onClick={onOpenAppointmentModal} // Special action: opens a modal
      />
      <ActionButton
        icon={<Clock size={24} />}
        label="Will Come Later"
        colorClass="bg-yellow-500 hover:bg-yellow-600"
        onClick={onOpenCallbackModal} // Special action: opens a modal
      />
      <ActionButton
        icon={<X size={24} />}
        label="Not Interested"
        colorClass="bg-red-500 hover:bg-red-600"
        onClick={() => onLog({ outcome: 'Not Interested' })}
      />
      <ActionButton
        icon={<PhoneOff size={24} />}
        label="No Reminder Call"
        colorClass="bg-gray-700 hover:bg-gray-800"
        onClick={() => onLog({ outcome: 'No Reminder Call' })}
      />
      <ActionButton
        icon={<PowerOff size={24} />}
        label="Switched Off"
        colorClass="bg-orange-500 hover:bg-orange-600"
        onClick={() => onLog({ outcome: 'Switched Off' })}
      />
      <ActionButton
        icon={<Phone size={24} />}
        label="Number Busy"
        colorClass="bg-blue-500 hover:bg-blue-600"
        onClick={() => onLog({ outcome: 'Number Busy' })}
      />
       <ActionButton
        icon={<CalendarPlus size={24} />}
        label="Specific Date"
        colorClass="bg-teal-500 hover:bg-teal-600"
        onClick={onOpenCallbackModal} // Same as "Will Come Later"
      />
      <ActionButton
        icon={<MessageSquareWarning size={24} />}
        label="Complaint"
        colorClass="bg-red-700 hover:bg-red-800"
        onClick={onOpenComplaintModal} // Special action: opens a modal
      />
    </div>
  );
}