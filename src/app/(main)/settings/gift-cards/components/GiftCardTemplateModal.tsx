'use client';

import React, { useState, useEffect } from 'react';
import  Button from '@/components/ui/Button';
import { IGiftCardTemplate } from '@/models/GiftCardTemplate';

// A simple Modal wrapper component. You might have a more advanced one in your UI library.
const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void; }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">&times;</button>
            {children}
        </div>
    </div>
);

interface Props {
    template: IGiftCardTemplate | null;
    onClose: () => void;
    onSaveSuccess: () => void;
}

export default function GiftCardTemplateModal({ template, onClose, onSaveSuccess }: Props) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        amount: '',
        validityInDays: '',
        isActive: true,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditMode = Boolean(template);

    useEffect(() => {
        if (template) {
            setFormData({
                name: template.name,
                description: template.description || '',
                amount: String(template.amount),
                validityInDays: String(template.validityInDays),
                isActive: template.isActive,
            });
        }
    }, [template]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        const apiEndpoint = isEditMode
            ? `/api/settings/gift-card-templates/${template?._id}`
            : '/api/settings/gift-card-templates';

        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const response = await fetch(apiEndpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    amount: Number(formData.amount),
                    validityInDays: Number(formData.validityInDays),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save template.');
            }

            onSaveSuccess();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal onClose={onClose}>
            <form onSubmit={handleSubmit}>
                <h2 className="text-xl font-bold mb-6">{isEditMode ? 'Update Gift Card' : 'Create New Gift Card'}</h2>
                
                {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <input
                            type="text"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Amount (₹)</label>
                        <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Validity (in days)</label>
                        <input
                            type="number"
                            name="validityInDays"
                            value={formData.validityInDays}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            required
                        />
                    </div>
                </div>

                <div className="flex items-center mb-6">
                    <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">Active</label>
                </div>

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}