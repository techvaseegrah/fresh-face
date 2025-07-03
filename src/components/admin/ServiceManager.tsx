'use client';

import { IServiceItem } from '@/models/ServiceItem';
import { IServiceCategory } from '@/models/ServiceCategory';
import { IServiceSubCategory } from '@/models/ServiceSubCategory';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { PlusIcon, PencilIcon, TrashIcon, UserIcon, SparklesIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import CategoryColumn from './CategoryColumn';
import ServiceFormModal from './ServiceFormModal';

type AudienceType = 'Unisex' | 'male' | 'female';
type EntityType = 'service-category' | 'service-sub-category' | 'service-item';

const ColumnSkeleton = () => (
  <div className="animate-pulse space-y-2 p-4">
    <div className="h-8 bg-gray-200 rounded-md w-3/4"></div>
    <div className="h-10 bg-gray-200 rounded-md"></div>
    <div className="h-10 bg-gray-200 rounded-md"></div>
    <div className="h-10 bg-gray-200 rounded-md"></div>
  </div>
);

export default function ServiceManager() {
  const { data: session } = useSession();

  const [audienceFilter, setAudienceFilter] = useState<AudienceType>('female');
  const [mainCategories, setMainCategories] = useState<IServiceCategory[]>([]);
  const [subCategories, setSubCategories] = useState<IServiceSubCategory[]>([]);
  const [services, setServices] = useState<IServiceItem[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<IServiceCategory | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [isLoadingSub, setIsLoadingSub] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEntityType, setModalEntityType] = useState<EntityType | null>(null);
  const [entityToEdit, setEntityToEdit] = useState<any | null>(null);

  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_CREATE);
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_UPDATE);
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_DELETE);

  const resetSelections = useCallback(() => {
    setSelectedMainCategory(null);
    setSelectedSubCategoryId(null);
    setSubCategories([]);
    setServices([]);
  }, []);

  const handleAudienceChange = (newAudience: AudienceType) => {
    if (newAudience === audienceFilter) return;
    setAudienceFilter(newAudience);
    resetSelections();
  };

  const fetchMainCategories = useCallback(async (audience: AudienceType) => {
    setIsLoadingMain(true);
    const res = await fetch(`/api/service-categories?audience=${audience}`);
    const data = await res.json();
    setMainCategories(data.success ? data.data : []);
    setIsLoadingMain(false);
  }, []);

  useEffect(() => {
    fetchMainCategories(audienceFilter);
  }, [audienceFilter, fetchMainCategories]);

  const fetchSubCategories = useCallback(async (mainCategoryId: string) => {
    setIsLoadingSub(true);
    setSelectedSubCategoryId(null);
    setServices([]);
    const res = await fetch(`/api/service-sub-categories?mainCategoryId=${mainCategoryId}`);
    const data = await res.json();
    setSubCategories(data.success ? data.data : []);
    setIsLoadingSub(false);
  }, []);

  const fetchServices = useCallback(async (subCategoryId: string) => {
    setIsLoadingServices(true);
    const res = await fetch(`/api/service-items?subCategoryId=${subCategoryId}`);
    const data = await res.json();
    setServices(data.success ? data.services : []);
    setIsLoadingServices(false);
  }, []);

  const handleSelectMainCategory = (category: IServiceCategory) => {
    setSelectedMainCategory(category);
    fetchSubCategories(category._id);
  };

  const handleSelectSubCategory = (subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId);
    fetchServices(subCategoryId);
  };

  const handleOpenModal = (type: EntityType, entity: any | null = null) => {
    setModalEntityType(type);
    setEntityToEdit(entity);
    setIsModalOpen(true);
  };

  const getApiPath = (entityType: EntityType) => {
    const paths: Record<EntityType, string> = {
      'service-category': 'service-categories',
      'service-sub-category': 'service-sub-categories',
      'service-item': 'service-items',
    };
    return paths[entityType] || '';
  };

  const handleSave = async (entityType: EntityType, data: any) => {
    const isEditing = !!entityToEdit;
    const id = isEditing ? entityToEdit._id : '';
    const apiPath = getApiPath(entityType);
    if (!apiPath) return;

    const url = isEditing ? `/api/${apiPath}/${id}` : `/api/${apiPath}`;
    const res = await fetch(url, { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

    if (res.ok) {
      setIsModalOpen(false);
      if (entityType === 'service-category') fetchMainCategories(audienceFilter);
      if (entityType === 'service-sub-category' && selectedMainCategory) fetchSubCategories(selectedMainCategory._id);
      if (entityType === 'service-item' && selectedSubCategoryId) fetchServices(selectedSubCategoryId);
    } else {
      const errorData = await res.json();
      alert(`Failed to save: ${errorData.error || 'Unknown error'}`);
    }
  };

  const handleDelete = async (entityType: EntityType, id: string) => {
    const apiPath = getApiPath(entityType);
    if (!apiPath) return;

    if (confirm(`Are you sure you want to delete this ${entityType.replace(/-/g, ' ')}?`)) {
      const res = await fetch(`/api/${apiPath}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (entityType === 'service-category') { resetSelections(); fetchMainCategories(audienceFilter); }
        if (entityType === 'service-sub-category' && selectedMainCategory) { setSelectedSubCategoryId(null); setServices([]); fetchSubCategories(selectedMainCategory._id); }
        if (entityType === 'service-item' && selectedSubCategoryId) fetchServices(selectedSubCategoryId);
      } else {
        const errorData = await res.json();
        alert(`Failed to delete: ${errorData.error || 'Unknown error'}`);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
      <ServiceFormModal
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave}
        entityType={modalEntityType} entityToEdit={entityToEdit}
        context={{
          audience: audienceFilter,
          mainCategory: selectedMainCategory,
          subCategoryId: selectedSubCategoryId,
        }}
      />
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Service Menu</h2>
          <div className="flex space-x-2 rounded-lg bg-gray-200 p-1">
            {([['female', UserIcon, 'Female'], ['male', UserIcon, 'Male'], ['Unisex', UserGroupIcon, 'Unisex']] as [AudienceType, React.ElementType, string][]).map(([type, Icon, label]) => (
              <button
                key={type}
                onClick={() => handleAudienceChange(type)}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${audienceFilter === type ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-600 hover:bg-gray-300/50'}`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-grow grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden">
        <div className="border-r border-gray-200 flex flex-col h-full">
          {isLoadingMain ? <ColumnSkeleton /> : (
            <CategoryColumn
              title="Categories"
              items={mainCategories}
              selectedId={selectedMainCategory?._id || null}
              onSelect={(id) => { const cat = mainCategories.find(c => c._id === id); if (cat) handleSelectMainCategory(cat); }}
              onEdit={canUpdate ? (item) => handleOpenModal('service-category', item) : undefined}
              onDelete={canDelete ? (id) => handleDelete('service-category', id) : undefined}
              onAddNew={canCreate ? () => handleOpenModal('service-category') : undefined}
              isLoading={isLoadingMain}
            />
          )}
        </div>
        <div className="border-r border-gray-200 flex flex-col h-full">
          {isLoadingSub ? <ColumnSkeleton /> : (
            <CategoryColumn
              title="Sub-Categories"
              items={subCategories}
              selectedId={selectedSubCategoryId}
              onSelect={handleSelectSubCategory}
              onEdit={canUpdate ? (item) => handleOpenModal('service-sub-category', item) : undefined}
              onDelete={canDelete ? (id) => handleDelete('service-sub-category', id) : undefined}
              onAddNew={canCreate ? () => handleOpenModal('service-sub-category') : undefined}
              isLoading={isLoadingSub}
              disabled={!selectedMainCategory}
              disabledText="Select a category to see its sub-categories."
            />
          )}
        </div>
        <div className="flex flex-col w-full h-full bg-gray-50/50">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
            <h3 className="font-semibold text-lg text-gray-800">Services</h3>
            {canCreate && (
              <button
                onClick={() => handleOpenModal('service-item')}
                disabled={!selectedSubCategoryId}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <PlusIcon className="h-4 w-4" /> Add Service
              </button>
            )}
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-3">
            {isLoadingServices && <div className="p-4 text-center text-gray-500">Loading services...</div>}
            {!isLoadingServices && services.map(service => (
              <div key={service._id} className="group bg-white p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-base">{service.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{service.duration} minutes</p>
                    {service.membershipRate && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full w-fit">
                        <SparklesIcon className="h-4 w-4" />
                        <span>Member Price: ₹{service.membershipRate.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-xl font-bold text-indigo-600">₹{service.price.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex justify-between items-end mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    {service.consumables && service.consumables.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold text-gray-600 uppercase text-[10px] mb-1">Consumables</p>
                        <ul className="space-y-0.5 list-disc list-inside">
                          {service.consumables.map((con, index) => {
                            const serviceAudience = service.audience as AudienceType;
                            const quantity = serviceAudience === 'male' && con.quantity.male !== undefined
                              ? con.quantity.male
                              : serviceAudience === 'female' && con.quantity.female !== undefined
                                ? con.quantity.female
                                : con.quantity.default;
                            return (
                              <li key={index}>
                                {(con.product as any)?.name || 'N/A'} - <span className="font-mono">{quantity}{con.unit}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canUpdate && <button onClick={() => handleOpenModal('service-item', service)} className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800"><PencilIcon className="h-4 w-4" /></button>}
                    {canDelete && <button onClick={() => handleDelete('service-item', service._id)} className="p-1.5 rounded-full text-red-500 hover:bg-red-100"><TrashIcon className="h-4 w-4" /></button>}
                  </div>
                </div>
              </div>
            ))}
            {!isLoadingServices && services.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-500 bg-white rounded-lg border-2 border-dashed">
                <h4 className="font-semibold text-base text-gray-700">No Services to Display</h4>
                <p className="mt-1">{selectedSubCategoryId ? 'There are no services in this sub-category.' : selectedMainCategory ? 'Please select a sub-category to view its services.' : 'Please select a category to get started.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}