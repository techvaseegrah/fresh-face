'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PackageTemplate } from '@/app/(main)/settings/package/types/packages';
import PackageTemplateModal from './PackageTemplateModal';
import  Button  from '@/components/ui/Button'; // Assuming you have a shared Button component
import LoadingSpinner from '@/components/LoadingSpinner'; // Assuming a shared spinner

export default function PackageTemplateList() {
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PackageTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/packages/templates');
      if (!res.ok) throw new Error('Failed to fetch package templates.');
      const data = await res.json();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setIsModalOpen(true);
  };

  const handleEdit = (template: PackageTemplate) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (template: PackageTemplate) => {
    if (!confirm(`Are you sure you want to ${template.isActive ? 'deactivate' : 'activate'} this package?`)) return;

    try {
        const res = await fetch(`/api/packages/templates/${template._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !template.isActive }),
        });

        if (!res.ok) throw new Error('Failed to update status.');
        
        // Refetch to get the latest data
        fetchTemplates();

    } catch (err: any) {
        alert(`Error: ${err.message}`);
    }
  };


  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    fetchTemplates(); // Refresh the list after saving
  };
  
  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <p className="mt-2 text-sm text-gray-700">A list of all the package templates in your salon.</p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button onClick={handleCreateNew}>Create New Package</Button>
        </div>
      </div>
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Price</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Validity</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Items</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Edit</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {templates.map((template) => (
                    <tr key={template._id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{template.name}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">₹{template.price.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{template.validityInDays} days</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{template.items.length}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${template.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>Edit</Button>
                        <Button variant="secondary" size="sm" onClick={() => handleToggleActive(template)}>
                            {template.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {isModalOpen && (
        <PackageTemplateModal
          templateData={selectedTemplate}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveSuccess}
        />
      )}
    </div>
  );
}