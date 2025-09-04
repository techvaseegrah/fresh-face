'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CustomerPackage } from '@/app/(main)/crm/types'; // Using the centralized CRM types
import { PackageRedemption } from './billing.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import  Button  from '@/components/ui/Button';
import { toast } from 'react-toastify';

interface RedeemPackageModalProps {
  customerId: string;
  billItems: any[]; // Pass current bill items to prevent re-redeeming the same service
  onRedeem: (redemptionData: PackageRedemption) => void;
  onClose: () => void;
}

export default function RedeemPackageModal({ customerId, billItems, onRedeem, onClose }: RedeemPackageModalProps) {
  const { data: session } = useSession();
  const [activePackages, setActivePackages] = useState<CustomerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.tenantId) return;

    const fetchPackages = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/customer/${customerId}/packages`, {
          credentials: 'include',
          headers: { 'x-tenant-id': session.user.tenantId },
        });
        if (!res.ok) throw new Error('Failed to fetch packages.');
        const allPackages: CustomerPackage[] = await res.json();
        
        // Filter for packages that are active and have items remaining
         const now = new Date();
        const redeemable = allPackages.filter(p => 
          p.status === 'active' && 
          new Date(p.expiryDate) > now && // Explicitly check the expiry date
          p.remainingItems.some(i => i.remainingQuantity > 0)
        );
        setActivePackages(redeemable);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [customerId, session]);

  const handleSelectRedemption = async (pkg: CustomerPackage, item: CustomerPackage['remainingItems'][0]) => {
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return;

    // Prevent redeeming an item that's already in the bill (as a regular or redeemed service)
    if (billItems.some(billItem => billItem.itemId === item.itemId)) {
        toast.info(`${item.itemName} is already part of the current bill.`);
        return;
    }

    try {
        // We need the original price of the service/product to show on the bill (struck-through)
        // So we must fetch the full item details.
        const endpoint = item.itemType === 'service' ? 'service-items' : 'products';
        const res = await fetch(`/api/${endpoint}/${item.itemId}`, {
            headers: { 'x-tenant-id': tenantId },
            credentials: 'include'
        });
        if(!res.ok) throw new Error("Could not fetch service/product details.");
        const itemDetails = await res.json();

        onRedeem({
            customerPackageId: pkg._id,
            redeemedItemId: item.itemId,
            redeemedItemType: item.itemType,
            quantityRedeemed: 1, // For now, we redeem one at a time
            itemDetails: itemDetails.service || itemDetails.product || itemDetails.data || itemDetails,
        });
        onClose();
    } catch (err: any) {
        toast.error(err.message || "An error occurred while preparing the redemption.");
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-70 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Redeem from Package</h2>
        {loading && <div className="text-center"><LoadingSpinner/></div>}
        {error && <p className="text-red-500">Error: {error}</p>}
        {!loading && activePackages.length === 0 && (
          <p className="text-gray-600">This customer has no active packages with remaining items.</p>
        )}
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {activePackages.map(pkg => (
            <div key={pkg._id} className="border rounded-md">
              <h3 className="text-md font-semibold bg-gray-50 p-3">{pkg.packageName}</h3>
              <ul className="divide-y">
                {pkg.remainingItems.filter(i => i.remainingQuantity > 0).map(item => (
                  <li key={item.itemId} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-800">{item.itemName}</p>
                      <p className="text-sm text-gray-500">{item.remainingQuantity} remaining</p>
                    </div>
                    <Button onClick={() => handleSelectRedemption(pkg, item)}>Redeem</Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 text-right">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}