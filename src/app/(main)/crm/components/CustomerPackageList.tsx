'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CustomerPackage } from '@/app/(main)/crm/types'; // Using the centralized CRM types
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatDateIST } from '@/lib/dateFormatter'; // 1. UPDATE the import to use your named export

interface CustomerPackageListProps {
  customerId: string;
}

const getStatusColor = (status: 'active' | 'completed' | 'expired') => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    case 'expired':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function CustomerPackageList({ customerId }: CustomerPackageListProps) {
  const { data: session } = useSession();
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId || !session?.user?.tenantId) {
      return;
    }

    const fetchCustomerPackages = async () => {
      setLoading(true);
      setError(null);
      const tenantId = session.user.tenantId;

      try {
        // NOTE: Ensure your API route is /api/customers/[id]/packages and not /api/customer/...
        const res = await fetch(`/api/customer/${customerId}/packages`, {
          credentials: 'include',
          headers: {
            'x-tenant-id': tenantId,
          },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch customer packages.');
        }

        const data = await res.json();
        setPackages(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerPackages();
  }, [customerId, session]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 p-4">Error: {error}</p>;
  }

  if (packages.length === 0) {
    return <p className="text-gray-500 p-4">This customer has no packages.</p>;
  }

  return (
    <div className="space-y-4 p-4">
      {packages.map((pkg) => (
        <div key={pkg._id} className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gray-50 p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">{pkg.packageName}</h3>
              <span className={`capitalize inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(pkg.status)}`}>
                {pkg.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {/* 2. USE the correct formatDateIST function */}
              Purchased on: {formatDateIST(pkg.purchaseDate)} | Expires on: {formatDateIST(pkg.expiryDate)}
            </p>
          </div>
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Remaining Items:</h4>
            <ul className="divide-y divide-gray-200">
              {pkg.remainingItems.map((item, index) => (
                <li key={`${item.itemId}-${index}`} className="py-2 flex justify-between items-center">
                  <span className="text-sm text-gray-800">{item.itemName}</span>
                  <span className="text-sm font-medium text-gray-600">
                    {item.remainingQuantity} / {item.totalQuantity} remaining
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}