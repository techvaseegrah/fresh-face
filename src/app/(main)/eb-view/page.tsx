// app/(main)/eb-view/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { DocumentTextIcon, CurrencyRupeeIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';

interface EBReading {
  _id: string; // Changed from id to _id
  date: string;
  startUnits?: number;
  endUnits?: number;
  unitsConsumed?: number;
  costPerUnit?: number;
  totalCost?: number;
  startImageUrl?: string;
  endImageUrl?: string;
  createdBy: string;
}

const EBReadingCard = ({ 
  reading, 
  onUpdate 
}: { 
  reading: EBReading;
  onUpdate: (id: string, startUnits: number, endUnits: number, costPerUnit: number) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [startUnits, setStartUnits] = useState(reading.startUnits || 0);
  const [endUnits, setEndUnits] = useState(reading.endUnits || 0);
  const [costPerUnit, setCostPerUnit] = useState(reading.costPerUnit || 0);

  const handleUpdate = async () => {
    if (startUnits < 0 || endUnits < 0 || costPerUnit < 0) {
      alert('Units and cost must be non-negative');
      return;
    }
    await onUpdate(reading._id, startUnits, endUnits, costPerUnit); // Changed reading.id to reading._id
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {new Date(reading.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </h3>
        {hasPermission(useSession()?.data?.user.role.permissions || [], PERMISSIONS.EB_VIEW_CALCULATE) && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Morning Reading</p>
          {isEditing ? (
            <input
              type="number"
              value={startUnits}
              onChange={(e) => setStartUnits(parseFloat(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md"
              step="0.01"
              placeholder="Enter morning units"
            />
          ) : (
            <p className="text-lg font-medium text-gray-900">
              {reading.startUnits ? `${reading.startUnits} units` : 'Not set'}
            </p>
          )}
          {reading.startImageUrl && (
            <div className="mt-2">
              <Image
                src={reading.startImageUrl}
                alt="Morning Meter Reading"
                width={200}
                height={200}
                className="rounded-md"
              />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Evening Reading</p>
          {isEditing ? (
            <input
              type="number"
              value={endUnits}
              onChange={(e) => setEndUnits(parseFloat(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md"
              step="0.01"
              placeholder="Enter evening units"
            />
          ) : (
            <p className="text-lg font-medium text-gray-900">
              {reading.endUnits ? `${reading.endUnits} units` : 'Not set'}
            </p>
          )}
          {reading.endImageUrl && (
            <div className="mt-2">
              <Image
                src={reading.endImageUrl}
                alt="Evening Meter Reading"
                width={200}
                height={200}
                className="rounded-md"
              />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-600 mb-1">Cost per Unit</p>
        {isEditing ? (
          <input
            type="number"
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(parseFloat(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md"
            step="0.01"
            placeholder="Enter cost per unit (INR)"
          />
        ) : (
          <p className="text-lg font-medium text-gray-900">
            {reading.costPerUnit
              ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.costPerUnit)
              : 'Not set'}
          </p>
        )}
      </div>
      {reading.startUnits && reading.endUnits && (
        <div className="mt-4 flex justify-between">
          <p className="text-sm text-gray-600">
            Units Consumed: <span className="font-medium text-gray-900">
              {reading.unitsConsumed ? `${reading.unitsConsumed} units` : 'Not calculated'}
            </span>
          </p>
          <p className="text-sm text-gray-600">
            Total Cost: <span className="font-medium text-gray-900">
              {reading.totalCost
                ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(reading.totalCost)
                : 'Not calculated'}
            </span>
          </p>
        </div>
      )}
      {isEditing && (
        <button
          onClick={handleUpdate}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Calculate & Save
        </button>
      )}
    </div>
  );
};

export default function EBViewPage() {
  const { data: session } = useSession();
  const [readings, setReadings] = useState<EBReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canViewCalculateEB = session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_VIEW_CALCULATE);

  useEffect(() => {
    fetchEBReadings();
  }, []);

  const fetchEBReadings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/eb');
      const data = await response.json();
      if (data.success) {
        setReadings(data.readings);
      }
    } catch (error) {
      console.error('Error fetching EB readings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (id: string, startUnits: number, endUnits: number, costPerUnit: number) => {
    try {
      const response = await fetch('/api/eb', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId: id, startUnits, endUnits, costPerUnit })
      });
      if (response.ok) {
        const data = await response.json();
        setReadings(readings.map(r => r._id === id ? data.reading : r)); // Changed r.id to r._id
      } else {
        const errorData = await response.json();
        alert(errorData.message);
      }
    } catch (error) {
      console.error('Error updating EB reading:', error);
      alert('Failed to update reading');
    }
  };

  if (!canViewCalculateEB) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <p className="text-red-600">You do not have permission to view or calculate EB readings.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  console.log('EB Readings:', readings);

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">EB Readings View & Calculate</h1>
          <p className="text-gray-600 mt-1">View meter images and calculate electricity costs</p>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Recent EB Readings</h2>
          <Link
            href="/eb-view/history"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
          >
            View History
            <DocumentTextIcon className="h-4 w-4 ml-1" />
          </Link>
        </div>
        <div className="p-6">
          {readings.length === 0 ? (
            <div className="text-center py-8">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No EB readings recorded yet</p>
            </div>
          ) : (
            readings.map((reading) => (
              <EBReadingCard key={reading._id} reading={reading} onUpdate={handleUpdate} /> // Changed reading.id to reading._id
            ))
          )}
        </div>
      </div>
    </div>
  );
}