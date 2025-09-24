// /components/EditWeekModal.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import { Loader2 } from 'lucide-react';

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

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EditWeekModal({ staff, weekDays, onClose, onSave, tenantId }: EditWeekModalProps) {
    const [reviews, setReviews] = useState<ReviewCounts>({});
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchExistingReviews = async () => {
            setLoading(true);
            const startDate = toLocalDateString(weekDays[0]);
            const endDate = toLocalDateString(weekDays[6]);
            try {
                const headers = new Headers({ 'X-Tenant-ID': tenantId });
                const res = await fetch(`/api/incentives/reviews?staffId=${staff.id}&startDate=${startDate}&endDate=${endDate}`, { headers });
                const result = await res.json();
                
                if (res.ok) {
                    const existingData = result.data;
                    const initialReviewState: ReviewCounts = {};
                    weekDays.forEach(day => {
                        const dateString = toLocalDateString(day);
                        const dataForDay = existingData[dateString];
                        initialReviewState[dateString] = {
                            reviewsWithName: dataForDay ? String(dataForDay.reviewsWithName) : '',
                            reviewsWithPhoto: dataForDay ? String(dataForDay.reviewsWithPhoto) : ''
                        };
                    });
                    setReviews(initialReviewState);
                } else {
                    toast.error("Could not load existing review data.");
                }
            } catch (error) {
                toast.error("Network error fetching review data.");
            } finally {
                setLoading(false);
            }
        };

        fetchExistingReviews();
    }, [staff.id, weekDays, tenantId]);


    const handleInputChange = (date: string, field: 'reviewsWithName' | 'reviewsWithPhoto', value: string) => {
        // Allow empty strings, but ensure any entered number is not negative.
        const cleanValue = value === '' ? '' : String(Math.max(0, Number(value)));
        setReviews(prev => ({
            ...prev,
            [date]: {
                ...(prev[date] || { reviewsWithName: '', reviewsWithPhoto: '' }), // Ensure the object exists before spreading
                [field]: cleanValue,
            }
        }));
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            const headers = new Headers({
                'Content-Type': 'application/json',
                'X-Tenant-ID': tenantId
            });

            const payloadReviews: { [date: string]: { reviewsWithName: number; reviewsWithPhoto: number } } = {};
            Object.entries(reviews).forEach(([date, counts]) => {
                payloadReviews[date] = {
                    reviewsWithName: Number(counts.reviewsWithName) || 0,
                    reviewsWithPhoto: Number(counts.reviewsWithPhoto) || 0
                };
            });

            const res = await fetch('/api/incentives/reviews', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    staffId: staff.id,
                    reviews: payloadReviews
                })
            });
            
            const result = await res.json();
            if (res.ok) {
                toast.success("Review counts saved successfully!");
                onSave();
                onClose();
            } else {
                toast.error(result.message || "An error occurred while saving.");
            }
        } catch (error) {
            toast.error("An error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Editing Week for {staff.name}</h2>
                <p className="text-gray-600 mb-6">Enter the number of reviews collected each day. Sales are synced automatically.</p>
                
                {loading ? (
                    <div className="flex justify-center items-center p-16">
                        <Loader2 className="animate-spin text-gray-500" size={32} />
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {weekDays.map(day => {
                            const dateString = toLocalDateString(day);
                            return (
                                <div key={dateString} className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 rounded-lg">
                                    <div className="font-semibold">
                                        {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </div>
                                    <input 
                                        type="number" 
                                        min="0"
                                        placeholder="Name Reviews" 
                                        className="p-2 border rounded text-black w-full"
                                        value={reviews[dateString]?.reviewsWithName || ''}
                                        onChange={(e) => handleInputChange(dateString, 'reviewsWithName', e.target.value)}
                                    />
                                    <input 
                                        type="number" 
                                        min="0"
                                        placeholder="Photo Reviews" 
                                        className="p-2 border rounded text-black w-full"
                                        value={reviews[dateString]?.reviewsWithPhoto || ''}
                                        onChange={(e) => handleInputChange(dateString, 'reviewsWithPhoto', e.target.value)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <Button onClick={onClose} variant="danger">Cancel</Button>
                    <Button onClick={handleSaveChanges} disabled={saving || loading} variant="black">
                        {saving ? (
                            <>
                                <Loader2 className="animate-spin mr-2" size={16}/> Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}