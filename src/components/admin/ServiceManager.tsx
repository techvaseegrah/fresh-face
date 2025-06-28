'use client';

import { IServiceItem } from '@/models/ServiceItem';
import { IServiceCategory } from '@/models/ServiceCategory';
import { IServiceSubCategory } from '@/models/ServiceSubCategory';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import CategoryColumn from './CategoryColumn';
import ServiceFormModal from './ServiceFormModal';

type AudienceType = 'Unisex' | 'male' | 'female';
type EntityType = 'service-category' | 'service-sub-category' | 'service-item';

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

  const fetchMainCategories = useCallback(async (audience: AudienceType) => {
    setIsLoadingMain(true);
    setSelectedMainCategory(null); setSelectedSubCategoryId(null);
    setSubCategories([]); setServices([]);
    const res = await fetch(`/api/service-categories?audience=${audience}`);
    const data = await res.json();
    if (data.success) setMainCategories(data.data);
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
    if (data.success) setSubCategories(data.data);
    setIsLoadingSub(false);
  }, []);

  const fetchServices = useCallback(async (subCategoryId: string) => {
    setIsLoadingServices(true);
    const res = await fetch(`/api/service-items?subCategoryId=${subCategoryId}`);
    const data = await res.json();
    if (data.success) setServices(data.data);
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
    if (entityType === 'service-category') return 'service-categories';
    if (entityType === 'service-sub-category') return 'service-sub-categories';
    if (entityType === 'service-item') return 'service-items';
    return '';
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
        if (entityType === 'service-category') fetchMainCategories(audienceFilter);
        if (entityType === 'service-sub-category' && selectedMainCategory) { setSelectedSubCategoryId(null); setServices([]); fetchSubCategories(selectedMainCategory._id); }
        if (entityType === 'service-item' && selectedSubCategoryId) fetchServices(selectedSubCategoryId);
      } else {
        const errorData = await res.json();
        alert(`Failed to delete: ${errorData.error || 'Unknown error'}`);
      }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <ServiceFormModal
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave}
        entityType={modalEntityType} entityToEdit={entityToEdit}
        context={{
          audience: audienceFilter,
          mainCategory: selectedMainCategory,
          subCategoryId: selectedSubCategoryId,
        }}
      />
      <div className="p-4 border-b border-gray-200">
        <div className="flex space-x-2 rounded-md bg-gray-100 p-1 w-min">
          {(['female', 'male', 'Unisex']  as AudienceType[]).map((type) => (
            <button key={type} onClick={() => setAudienceFilter(type)}
              className={`px-6 py-1.5 text-sm font-medium rounded-md transition-colors ${audienceFilter === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >{type}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col md:flex-row h-[calc(100vh-250px)]">
        <CategoryColumn
          title="Categories" items={mainCategories} selectedId={selectedMainCategory?._id || null}
          onSelect={(id) => { const cat = mainCategories.find(c => c._id === id); if (cat) handleSelectMainCategory(cat); }}
          onEdit={canUpdate ? (item) => handleOpenModal('service-category', item) : undefined}
          onDelete={canDelete ? (id) => handleDelete('service-category', id) : undefined}
          onAddNew={canCreate ? () => handleOpenModal('service-category') : undefined}
          isLoading={isLoadingMain}
        />
        <CategoryColumn
          title="Sub-Categories" items={subCategories} selectedId={selectedSubCategoryId}
          onSelect={handleSelectSubCategory}
          onEdit={canUpdate ? (item) => handleOpenModal('service-sub-category', item) : undefined}
          onDelete={canDelete ? (id) => handleDelete('service-sub-category', id) : undefined}
          onAddNew={canCreate ? () => handleOpenModal('service-sub-category') : undefined}
          isLoading={isLoadingSub} disabled={!selectedMainCategory}
        />
        <div className="flex flex-col w-full md:w-1/3 bg-white">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-lg text-gray-800">Services</h3>
            {canCreate && (
              <button 
                onClick={() => handleOpenModal('service-item')} 
                disabled={!selectedSubCategoryId} 
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-black rounded-md disabled:bg-gray-300"
              >
                <PlusIcon className="h-4 w-4" /> Add Service
              </button>
            )}
          </div>
          <div className="flex-grow overflow-y-auto">
            {isLoadingServices && <div className="p-4 text-center text-gray-500">Loading...</div>}
            {services.map(service => (
              <div key={service._id} className="group p-4 border-b hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{service.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{service.duration} mins</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-semibold text-gray-900">₹{service.price.toFixed(2)}</p>
                    <div className="flex justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100">
                      {canUpdate && <button onClick={() => handleOpenModal('service-item', service)} className="p-1.5 rounded hover:bg-gray-200"><PencilIcon className="h-5 w-5" /></button>}
                      {canDelete && <button onClick={() => handleDelete('service-item', service._id)} className="p-1.5 rounded text-red-500 hover:bg-red-100"><TrashIcon className="h-5 w-5" /></button>}
                    </div>
                  </div>
                </div>
                {service.consumables && service.consumables.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Consumables</p>
                    <ul className="mt-2 space-y-1">
                      {service.consumables.map((con, index) => {
                        const product = con.product as any;
                        const qty = con.quantity;
                        return (
                          <li key={index} className="text-sm text-gray-700">
                            <div className="flex justify-between items-start">
                              <span className="font-medium">{product?.name || 'Product not found'}</span>
                              <div className="text-right text-xs font-mono text-gray-500">
                                <div>Default: {qty.default} {con.unit}</div>
                                {qty.male !== undefined && <div>Male: {qty.male} {con.unit}</div>}
                                {qty.female !== undefined && <div>Female: {qty.female} {con.unit}</div>}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {!isLoadingServices && services.length === 0 && <div className="p-8 text-center text-sm text-gray-400">No services found.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}