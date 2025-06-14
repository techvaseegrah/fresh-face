// app/(main)/eb-upload/page.tsx
'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { ArrowUpTrayIcon, LightBulbIcon } from '@heroicons/react/24/outline';

export default function EBUploadPage() {
  const { data: session } = useSession();
  const [type, setType] = useState<'morning' | 'evening'>('morning');
  const [image, setImage] = useState<File | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  const canUploadEB = session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD);

  if (!canUploadEB) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <p className="text-red-600">You do not have permission to upload EB readings.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !date) {
      alert('Image and date are required');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('type', type);
    formData.append('image', image);
    formData.append('date', date);

    

    try {
      const response = await fetch('/api/eb', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        alert(`${type.charAt(0).toUpperCase() + type.slice(1)} reading uploaded successfully`);
        setImage(null);
        setDate(new Date().toISOString().split('T')[0]);
      } else {
        const errorData = await response.json();
        alert(errorData.message);
      }
    } catch (error) {
      console.error('Error uploading EB reading:', error);
      alert('Failed to upload reading');
    } finally {
      setIsLoading(false);
    }
  };

  

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">EB Reading Upload</h1>
          <p className="text-gray-600 mt-1">Upload morning or evening meter images</p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Meter Image</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-600">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md mt-1"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Reading Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'morning' | 'evening')}
              className="w-full p-2 border border-gray-300 rounded-md mt-1"
              disabled={isLoading}
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Meter Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="mt-2"
              disabled={isLoading}
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              {isLoading ? 'Uploading...' : 'Upload Image'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}