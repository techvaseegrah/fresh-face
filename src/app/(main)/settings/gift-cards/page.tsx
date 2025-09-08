'use client';

import React, 
{ 
    useState, 
    useEffect, 
    useCallback 
} from 'react';
import Button from '@/components/ui/Button';
import GiftCardTemplateModal from '@/app/(main)/settings/gift-cards/components/GiftCardTemplateModal';
import { IGiftCardTemplate } from '@/models/GiftCardTemplate';
import { 
  CreditCard, 
  Edit, 
  Calendar, 
  DollarSign, 
  Plus,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Mobile Responsive Gift Card Template Item Component
const GiftCardTemplateItem = ({ template, onEdit }: { template: IGiftCardTemplate; onEdit: (template: IGiftCardTemplate) => void; }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out hover:shadow-md">
        <div className="border-t-4 border-green-500"></div>
        <div className="p-4 md:p-6">
            {/* Mobile Layout */}
            <div className="md:hidden space-y-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 bg-green-100 p-2 rounded-full">
                        <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-gray-800 leading-tight">{template.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold mt-2 ${
                            template.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-500">Amount</span>
                        </div>
                        <p className="font-semibold text-gray-900">₹{template.amount}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-500">Validity</span>
                        </div>
                        <p className="font-semibold text-gray-900">{template.validityInDays} days</p>
                    </div>
                </div>
                
                <Button 
                    onClick={() => onEdit(template)} 
                    variant="outline" 
                    icon={<Edit size={16} />}
                    className="w-full min-h-[44px] border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                >
                    Edit Gift Card
                </Button>
            </div>
            
            {/* Desktop Layout */}
            <div className="hidden md:flex md:justify-between md:items-center">
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 bg-green-100 p-3 rounded-full">
                        <CreditCard className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">{template.name}</h3>
                        <p className="text-gray-600">Amount: ₹{template.amount} | Validity: {template.validityInDays} days</p>
                        <span className={`text-sm font-semibold ${
                            template.isActive ? 'text-green-600' : 'text-red-600'
                        }`}>
                            {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <Button 
                    onClick={() => onEdit(template)} 
                    variant="outline"
                    icon={<Edit size={16} />}
                    className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                >
                    Edit
                </Button>
            </div>
        </div>
    </div>
);

// Loading State Component
const LoadingState = () => (
    <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 text-center">
        <div className="mx-auto h-12 w-12 md:h-14 md:w-14 flex items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <h3 className="mt-4 md:mt-5 text-lg md:text-xl font-semibold text-gray-900">Loading Gift Cards...</h3>
        <p className="mt-2 text-sm md:text-base text-gray-500">Fetching the latest gift card templates.</p>
    </div>
);

// Empty State Component
const EmptyState = ({ onCreateNew }: { onCreateNew: () => void }) => (
    <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 text-center">
        <div className="mx-auto h-12 w-12 md:h-14 md:w-14 flex items-center justify-center rounded-full bg-green-100 text-green-600">
            <CreditCard className="h-6 w-6 md:h-7 md:w-7" />
        </div>
        <h3 className="mt-4 md:mt-5 text-lg md:text-xl font-semibold text-gray-900">No Gift Cards Found</h3>
        <p className="mt-2 text-sm md:text-base text-gray-500 mb-6">
            Create your first gift card template to start offering gift cards to your customers.
        </p>
        <Button 
            onClick={onCreateNew}
            className="bg-green-600 hover:bg-green-700 focus:ring-green-500 min-h-[44px] px-6"
            icon={<Plus size={16} />}
        >
            Create First Gift Card
        </Button>
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
        <div className="bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-8">
                {/* Mobile and Desktop Header */}
                <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-6 md:mb-8 pb-4 md:pb-6 border-b border-gray-200">
                    <div className="flex-1">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
                            Manage Gift Cards
                        </h1>
                        <p className="text-sm md:text-base text-gray-500 mt-1">
                            Create and manage gift card templates for your customers.
                        </p>
                    </div>
                    
                    {/* Create Button - Hidden on mobile when no templates, shown in empty state instead */}
                    {templates.length > 0 && (
                        <Button 
                            onClick={handleOpenModalForCreate}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 focus:ring-green-500 min-h-[44px] font-semibold"
                            icon={<Plus size={16} />}
                        >
                            <span className="md:hidden">Create New</span>
                            <span className="hidden md:inline">Create New Gift Card</span>
                        </Button>
                    )}
                </header>

                {/* Main Content */}
                <main>
                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-4 md:gap-6">
                            <LoadingState />
                        </div>
                    ) : (
                        <div className="space-y-4 md:space-y-6">
                            {templates.length > 0 ? (
                                templates.map((template) => (
                                    <GiftCardTemplateItem 
                                        key={template._id as string} 
                                        template={template} 
                                        onEdit={handleOpenModalForEdit}
                                    />
                                ))
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:gap-6">
                                    <EmptyState onCreateNew={handleOpenModalForCreate} />
                                </div>
                            )}
                        </div>
                    )}
                </main>
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