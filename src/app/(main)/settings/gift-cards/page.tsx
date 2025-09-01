'use client';

import React, 
{ 
    useState, 
    useEffect, 
    useCallback 
} from 'react';
import Button  from '@/components/ui/Button'; // Assuming you have a Button component
import GiftCardTemplateModal from '@/app/(main)/settings/gift-cards/components/GiftCardTemplateModal'
import { IGiftCardTemplate } from '@/models/GiftCardTemplate'; // Import the interface

// A simple component to display a single gift card template
const GiftCardTemplateItem = ({ template, onEdit }: { template: IGiftCardTemplate; onEdit: (template: IGiftCardTemplate) => void; }) => (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 flex justify-between items-center">
        <div>
            <h3 className="font-bold text-lg">{template.name}</h3>
            <p className="text-gray-600">Amount: ₹{template.amount} | Validity: {template.validityInDays} days</p>
            <span className={`text-sm font-semibold ${template.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {template.isActive ? 'Active' : 'Inactive'}
            </span>
        </div>
        <Button onClick={() => onEdit(template)} variant="outline">Edit</Button>
    </div>
);


export default function GiftCardSettingsPage() {
    const [templates, setTemplates] = useState<IGiftCardTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<IGiftCardTemplate | null>(null);

    const fetchTemplates = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/settings/gift-card-templates');
            if (response.ok) {
                const data = await response.json();
                setTemplates(data);
            } else {
                console.error("Failed to fetch templates");
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleOpenModalForCreate = () => {
        setSelectedTemplate(null);
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (template: IGiftCardTemplate) => {
        setSelectedTemplate(template);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedTemplate(null);
    };

    const handleSaveSuccess = () => {
        handleCloseModal();
        fetchTemplates(); // Refresh the list after saving
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Manage Gift Cards</h1>
                    <Button onClick={handleOpenModalForCreate}>
                        + Create New Gift Card
                    </Button>
                </div>

                {isLoading ? (
                    <p>Loading...</p>
                ) : (
                    <div className="space-y-4">
                        {templates.length > 0 ? (
                            templates.map((template) => (
                                <GiftCardTemplateItem 
                                    key={template._id} 
                                    template={template} 
                                    onEdit={handleOpenModalForEdit}
                                />
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-8">No gift card templates found. Create one to get started!</p>
                        )}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <GiftCardTemplateModal
                    template={selectedTemplate}
                    onClose={handleCloseModal}
                    onSaveSuccess={handleSaveSuccess}
                />
            )}
        </div>
    );
}