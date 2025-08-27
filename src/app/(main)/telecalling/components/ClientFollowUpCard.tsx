'use client';

import { TelecallingClient } from '../hooks/useTelecallingQueue';
import { FaUser, FaPhone, FaTools, FaCalendarDay, FaUserTie, FaRupeeSign } from 'react-icons/fa';

interface Props {
  client: TelecallingClient | null;
}

export default function ClientFollowUpCard({ client }: Props) {
  // Handles the state when the queue is empty
  if (!client) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-semibold text-gray-700">Queue is Empty!</h2>
        <p className="mt-2 text-gray-500">Great job, you've contacted everyone for now.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 relative">
      {/* This banner will only appear if the client is a scheduled callback */}
      {client.isCallback && (
        <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded-md text-center font-semibold text-sm">
          This is a Scheduled Callback
        </div>
      )}
      
      {/* A 3x2 grid to neatly display all the enriched information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* --- Column 1: Core Client Info --- */}
        <div className="flex items-center space-x-4">
          <FaUser className="text-blue-500 text-2xl flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-500">Name</p>
            <p className="text-lg font-bold text-gray-800 uppercase">{client.searchableName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <FaPhone className="text-green-500 text-2xl flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-500">Phone Number</p>
            <p className="text-lg font-bold text-gray-800">{client.phoneNumber}</p>
          </div>
        </div>

        {/* --- Column 2: Last Appointment Service Details --- */}
        <div className="flex items-center space-x-4">
          <FaTools className="text-purple-500 text-2xl flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-500">Last Service(s)</p>
            <p className="text-lg font-bold text-gray-800 capitalize">
              {client.lastServiceNames?.join(', ') || 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <FaUserTie className="text-gray-600 text-2xl flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-500">Last Stylist</p>
            <p className="text-lg font-bold text-gray-800">{client.lastStylistName}</p>
          </div>
        </div>

        {/* --- Column 3: Last Appointment Time & Financials --- */}
        <div className="flex items-center space-x-4">
          <FaCalendarDay className="text-red-500 text-2xl flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-500">Last Visit Date</p>
            <p className="text-lg font-bold text-gray-800">
              {client.lastVisitDate ? new Date(client.lastVisitDate).toLocaleDateString('en-GB') : 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <FaRupeeSign className="text-green-600 text-2xl flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-500">Last Bill Amount</p>
            <p className="text-lg font-bold text-gray-800">₹{client.lastBillAmount?.toFixed(0) || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}