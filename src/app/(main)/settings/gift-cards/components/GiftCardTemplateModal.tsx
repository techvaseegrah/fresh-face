  'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { IGiftCardTemplate } from '@/models/GiftCardTemplate';
import { X, CreditCard, DollarSign, Calendar, FileText, CheckCircle } from 'lucide-react';

// Enhanced Mobile Responsive Modal wrapper component
const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void; }) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
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
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                            <CreditCard className="h-5 w-5 text-green-600" />
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-gray-900">
                            {isEditMode ? 'Update Gift Card' : 'Create New Gift Card'}
                        </h2>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                {/* Content */}
                <div className="p-4 md:p-6 flex-1 overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 flex items-center gap-2">
                            <div className="h-5 w-5 text-red-500 flex-shrink-0">⚠️</div>
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <div className="space-y-4 md:space-y-6">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                                Gift Card Name
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-3 md:py-2.5 border-2 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none text-gray-900 text-base disabled:bg-gray-100"
                                    placeholder="Enter gift card name"
                                    required
                                />
                            </div>
                        </div>

                        {/* Description Field */}
                        <div>
                            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                                Description (Optional)
                            </label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-3 py-3 md:py-2.5 border-2 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none text-gray-900 text-base disabled:bg-gray-100"
                                    placeholder="Enter description"
                                />
                            </div>
                        </div>

                        {/* Amount and Validity - Mobile: Stacked, Desktop: Side by side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div>
                                <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Amount (₹)
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="number"
                                        id="amount"
                                        name="amount"
                                        value={formData.amount}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-3 py-3 md:py-2.5 border-2 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none text-gray-900 text-base disabled:bg-gray-100"
                                        placeholder="0"
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="validityInDays" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Validity (Days)
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="number"
                                        id="validityInDays"
                                        name="validityInDays"
                                        value={formData.validityInDays}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-3 py-3 md:py-2.5 border-2 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none text-gray-900 text-base disabled:bg-gray-100"
                                        placeholder="30"
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    name="isActive"
                                    checked={formData.isActive}
                                    onChange={handleChange}
                                    className="h-5 w-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <label htmlFor="isActive" className="text-sm font-semibold text-gray-900">
                                    Active Status
                                </label>
                            </div>
                            <span className="text-xs text-gray-500">Enable this gift card template</span>
                        </div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="bg-gray-50 px-4 md:px-6 py-4 flex flex-col gap-3 md:flex-row md:gap-0 md:justify-end md:space-x-3 border-t">
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={onClose}
                        className="w-full md:w-auto order-2 md:order-1 py-3 md:py-2 rounded-lg border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={isSaving}
                        className="w-full md:w-auto bg-green-600 hover:bg-green-700 focus:ring-green-500 order-1 md:order-2 py-3 md:py-2 font-semibold rounded-lg"
                    >
                        {isSaving ? 'Saving...' : (isEditMode ? 'Update Gift Card' : 'Create Gift Card')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}