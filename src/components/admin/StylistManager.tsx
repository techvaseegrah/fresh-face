// components/StylistManager.tsx

'use client';

import { IStylist } from '@/models/Stylist';
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import StylistFormModal from './StylistFormModal';
import StylistHistoryModal from '../StylistHistoryModal';

// Define the history item interface here or import it
interface IStylistHistoryItem {
  _id: string;
  date: string;
  customerName: string;
  services: string;
  amount: number;
  estimatedDuration: number;
  actualDuration: number;
}

export default function StylistManager() {
  const [stylists, setStylists] = useState<IStylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStylist, setEditingStylist] = useState<IStylist | null>(null);

  // States for history modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedStylist, setSelectedStylist] = useState<IStylist | null>(null);
  const [historyData, setHistoryData] = useState<IStylistHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchStylists = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stylists');
      const data = await res.json();
      if (data.success) {
        setStylists(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stylists", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStylists();
  }, []);

  const handleOpenFormModal = (stylist: IStylist | null = null) => {
    setEditingStylist(stylist);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditingStylist(null);
  };

  const handleViewHistory = async (stylist: IStylist) => {
    setSelectedStylist(stylist);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    try {
      // Use the new endpoint with a query parameter
      const res = await fetch(`/api/stylist-history?stylistId=${stylist._id}`);
      const data = await res.json();
      if (data.success) {
        setHistoryData(data.data);
      } else {
        console.error("Failed to fetch stylist history:", data.message);
        setHistoryData([]); // Clear previous data on error
      }
    } catch (error) {
      console.error("Error fetching stylist history:", error);
      setHistoryData([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedStylist(null);
    setHistoryData([]);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this stylist?')) {
      try {
        const res = await fetch(`/api/stylists?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchStylists();
        } else {
          console.error("Failed to delete stylist");
        }
      } catch (error) {
        console.error("Error deleting stylist", error);
      }
    }
  };
  
  const handleSave = async (stylistData: any) => {
    const isEditing = !!editingStylist;
    const url = isEditing ? `/api/stylists?id=${editingStylist!._id}` : '/api/stylists';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stylistData),
      });

      if (res.ok) {
        handleCloseFormModal();
        fetchStylists();
      } else {
        const errorData = await res.json();
        alert(`Failed to save: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to save stylist', error);
      alert('An error occurred while saving.');
    }
  };

  if (isLoading) {
    return <div>Loading stylists...</div>;
  }

  return (
    <>
      <StylistFormModal
        isOpen={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSave={handleSave}
        stylistToEdit={editingStylist}
      />
      
      <StylistHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={handleCloseHistoryModal}
        stylistName={selectedStylist?.name || ''}
        history={historyData}
        isLoading={isHistoryLoading}
      />

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Manage Stylists</h2>
            <p className="text-sm text-gray-500">View, add, edit, or delete stylists.</p>
          </div>
          <button
            onClick={() => handleOpenFormModal()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
          >
            <PlusIcon className="h-5 w-5" />
            Add New Stylist
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">S.No</th>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3">Experience</th>
                <th scope="col" className="px-6 py-3">Specialization</th>
                <th scope="col" className="px-6 py-3">Phone</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stylists.map((stylist, index) => (
                <tr key={stylist._id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4">{index + 1}</td>
                  <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                    {stylist.name}
                  </th>
                  <td className="px-6 py-4">{stylist.experience} years</td>
                  <td className="px-6 py-4">{stylist.specialization}</td>
                  <td className="px-6 py-4">{stylist.phone}</td>
                  <td className="px-6 py-4 flex justify-end gap-1">
                    <button onClick={() => handleViewHistory(stylist)} className="p-2 text-gray-500 hover:text-black rounded-md hover:bg-gray-100" title="View History">
                      <ClockIcon className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleOpenFormModal(stylist)} className="p-2 text-gray-500 hover:text-black rounded-md hover:bg-gray-100" title="Edit Stylist">
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleDelete(stylist._id)} className="p-2 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50" title="Delete Stylist">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stylists.length === 0 && !isLoading && (
              <div className="text-center p-8 text-gray-500">
                  No stylists found. Click "Add New Stylist" to get started.
              </div>
          )}
        </div>
      </div>
    </>
  );
}