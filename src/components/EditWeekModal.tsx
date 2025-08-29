import React, { useState } from 'react';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';

interface EditWeekModalProps {
  staff: { id: string; name: string };
  weekDays: Date[];
  onClose: () => void;
  onSave: () => void;
  tenantId: string;
}

interface ReviewCounts {
    [date: string]: { reviewsWithName: string; reviewsWithPhoto: string };
}

// ✅ FIX: Add the same helper function here to ensure consistency
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EditWeekModal({ staff, weekDays, onClose, onSave, tenantId }: EditWeekModalProps) {
    const [reviews, setReviews] = useState<ReviewCounts>({});
    const [saving, setSaving] = useState(false);

    const handleInputChange = (date: string, field: 'reviewsWithName' | 'reviewsWithPhoto', value: string) => {
        setReviews(prev => ({
            ...prev,
            [date]: {
                ...prev[date],
                reviewsWithName: field === 'reviewsWithName' ? value : (prev[date]?.reviewsWithName || ''),
                reviewsWithPhoto: field === 'reviewsWithPhoto' ? value : (prev[date]?.reviewsWithPhoto || ''),
            }
        }));
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        const promises = Object.entries(reviews).map(([date, counts]) => {
            const headers = new Headers({
                'Content-Type': 'application/json',
                'X-Tenant-ID': tenantId
            });
            return fetch('/api/incentives', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    staffId: staff.id,
                    date: date,
                    reviewsWithName: Number(counts.reviewsWithName) || 0,
                    reviewsWithPhoto: Number(counts.reviewsWithPhoto) || 0,
                })
            });
        });

        try {
            await Promise.all(promises);
            toast.success("Review counts saved successfully!");
            onSave();
        } catch (error) {
            toast.error("An error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Editing Week for {staff.name}</h2>
                <p className="text-gray-600 mb-6">Enter the number of reviews collected each day. Sales are synced automatically.</p>
                
                <div className="space-y-4">
                    {weekDays.map(day => {
                        // ✅ FIX: Use the local date helper function here
                        const dateString = toLocalDateString(day);
                        return (
                            <div key={dateString} className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 rounded-lg">
                                <div className="font-semibold">
                                    {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </div>
                                <input 
                                    type="number" 
                                    placeholder="Name Reviews" 
                                    className="p-2 border rounded text-black w-full"
                                    onChange={(e) => handleInputChange(dateString, 'reviewsWithName', e.target.value)}
                                />
                                <input 
                                    type="number" 
                                    placeholder="Photo Reviews" 
                                    className="p-2 border rounded text-black w-full"
                                    onChange={(e) => handleInputChange(dateString, 'reviewsWithPhoto', e.target.value)}
                                />
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <Button onClick={onClose} variant="danger">Cancel</Button>
                    <Button onClick={handleSaveChanges} disabled={saving} variant="black">{saving ? 'Saving...' : 'Save Changes'}</Button>
                </div>
            </div>
        </div>
    );
}