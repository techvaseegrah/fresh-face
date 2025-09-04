'use client';
import React, { useState } from 'react';
import  Button  from '@/components/ui/Button';

interface Props {
    onApply: (cardData: { cardId: string; code: string; balance: number }) => void;
    onClose: () => void;
}

export default function ApplyGiftCardModal({ onApply, onClose }: Props) {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleValidate = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/billing/validate-gift-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uniqueCode: code }),
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.message);
            
            onApply({ cardId: data.id, code: data.uniqueCode, balance: data.currentBalance });

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h3 className="text-lg font-medium mb-4">Apply Gift Card</h3>
                {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Enter gift card number"
                    className="w-full border border-gray-300 rounded-md p-2"
                />
                <div className="flex justify-end gap-3 mt-4">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    <Button onClick={handleValidate} disabled={isLoading}>
                        {isLoading ? 'Validating...' : 'Validate & Apply'}
                    </Button>
                </div>
            </div>
        </div>
    );
}