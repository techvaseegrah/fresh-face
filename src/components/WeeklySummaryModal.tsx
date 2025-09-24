// /components/WeeklySummaryModal.tsx

import React from 'react';
import { X, TrendingUp, ShoppingBag, Box, Gift, Star, UserCheck } from 'lucide-react';
import Card from '@/components/ui/Card';

interface SummaryData {
  totalNetServiceSale: number;
  totalProductSale: number;
  totalPackageSale: number;
  totalGiftCardSale: number;
  totalReviewsWithName: number;
  totalReviewsWithPhoto: number;
  totalCustomerCount: number;
}

interface WeeklySummaryModalProps {
  staffName: string;
  data: SummaryData | null;
  onClose: () => void;
  weekRange: string;
}

const SummaryItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
  <div className="flex items-start p-4 bg-slate-50 rounded-lg">
    <div className="text-indigo-500 mr-4 mt-1">{icon}</div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

export default function WeeklySummaryModal({ staffName, data, onClose, weekRange }: WeeklySummaryModalProps) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-fade-in-up">
        <div className="flex justify-between items-center p-5 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Weekly Summary: {staffName}</h2>
            <p className="text-sm text-slate-500">{weekRange}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryItem icon={<TrendingUp size={24} />} label="Net Service Sales" value={`₹${data.totalNetServiceSale.toFixed(2)}`} />
            <SummaryItem icon={<ShoppingBag size={24} />} label="Product Sales" value={`₹${data.totalProductSale.toFixed(2)}`} />
            <SummaryItem icon={<Box size={24} />} label="Package Sales" value={`₹${data.totalPackageSale.toFixed(2)}`} />
            <SummaryItem icon={<Gift size={24} />} label="Gift Card Sales" value={`₹${data.totalGiftCardSale.toFixed(2)}`} />
            <SummaryItem icon={<Star size={24} />} label="Reviews (Name / Photo)" value={`${data.totalReviewsWithName} / ${data.totalReviewsWithPhoto}`} />
            <SummaryItem icon={<UserCheck size={24} />} label="Total Customers Served" value={data.totalCustomerCount} />
          </div>
        </div>
      </Card>
    </div>
  );
}