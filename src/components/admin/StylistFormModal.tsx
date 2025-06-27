'use client';

import { IStylist } from '@/models/Stylist';
import { useState, useEffect, FormEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stylist: Omit<IStylist, '_id' | 'createdAt' | 'updatedAt'>) => void;
  stylistToEdit: IStylist | null;
}

export default function StylistFormModal({ isOpen, onClose, onSave, stylistToEdit }: Props) {
  const [name, setName] = useState('');
  const [experience, setExperience] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (stylistToEdit) {
      setName(stylistToEdit.name);
      setExperience(stylistToEdit.experience.toString());
      setSpecialization(stylistToEdit.specialization);
      setPhone(stylistToEdit.phone);
    } else {
      // Reset form for "Add New"
      setName('');
      setExperience('');
      setSpecialization('');
      setPhone('');
    }
  }, [stylistToEdit, isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !experience || !specialization || !phone) {
        alert('Please fill all fields');
        return;
    }
    onSave({
      name,
      experience: parseInt(experience, 10),
      specialization,
      phone,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <XMarkIcon className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold mb-4">{stylistToEdit ? 'Edit Stylist' : 'Add New Stylist'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
          </div>
          <div>
            <label htmlFor="experience" className="block text-sm font-medium text-gray-700">Experience (Years)</label>
            <input type="number" id="experience" value={experience} onChange={e => setExperience(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
          </div>
          <div>
            <label htmlFor="specialization" className="block text-sm font-medium text-gray-700">Specialization</label>
            <input type="text" id="specialization" value={specialization} onChange={e => setSpecialization(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}