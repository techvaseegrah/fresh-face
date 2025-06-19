'use client';

import { useState, useEffect, FormEvent } from 'react';
import { IProduct } from '@/models/Product';
import { IServiceConsumable } from '@/models/ServiceItem';
import { useDebounce } from '@/hooks/useDebounce';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { IServiceCategory } from '@/models/ServiceCategory';

type EntityType = 'service-category' | 'service-sub-category' | 'service-item';
type AudienceType = 'Men' | 'Women' | 'Unisex' | 'Children';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entityType: EntityType, data: any) => void;
  entityType: EntityType | null;
  entityToEdit: any | null;
  context: {
    audience: AudienceType;
    mainCategory?: IServiceCategory | null;
    subCategoryId?: string;
  };
}

export default function ServiceFormModal({ isOpen, onClose, onSave, entityType, entityToEdit, context }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [consumables, setConsumables] = useState<IServiceConsumable[]>([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [foundProduct, setFoundProduct] = useState<IProduct | null>(null);
  const debouncedSku = useDebounce(skuSearch, 300);

  useEffect(() => {
    if (isOpen) {
      if (entityToEdit) {
        setFormData(entityToEdit);
        if (entityType === 'service-item') setConsumables(entityToEdit.consumables || []);
      } else {
        setFormData({}); setConsumables([]);
      }
      setSkuSearch(''); setFoundProduct(null);
    }
  }, [entityToEdit, isOpen, entityType]);
  
  useEffect(() => {
    if (debouncedSku.trim()) {
      fetch(`/api/products?sku=${debouncedSku.toUpperCase()}`)
        .then(res => res.json())
        .then(data => { setFoundProduct(data.success && data.data.length > 0 ? data.data[0] : null); });
    } else {
      setFoundProduct(null);
    }
  }, [debouncedSku]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || '' : value }));
  };

  const handleAddConsumable = () => {
    if (!foundProduct) return;
    const newConsumable: IServiceConsumable = { product: foundProduct, quantity: 1, unit: foundProduct.unit || 'pcs' };
    setConsumables([...consumables, newConsumable]);
    setSkuSearch(''); setFoundProduct(null);
  };
  
  const handleConsumableChange = (index: number, field: 'quantity' | 'unit', value: string | number) => {
    const updated = [...consumables];
    updated[index] = { ...updated[index], [field]: value };
    setConsumables(updated);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!entityType) return;
    
    let payload = { ...formData };
    if (entityToEdit) payload._id = entityToEdit._id;
    else {
      if (entityType === 'service-category') payload.targetAudience = context.audience;
      if (entityType === 'service-sub-category') payload.mainCategory = context.mainCategory?._id;
      if (entityType === 'service-item') payload.subCategory = context.subCategoryId;
    }
    if (entityType === 'service-item') {
      payload.consumables = consumables.map(c => ({ product: (c.product as IProduct)._id, quantity: c.quantity, unit: c.unit }));
    }
    onSave(entityType, payload);
  };

  if (!isOpen) return null;

  const getTitle = () => {
    const action = entityToEdit ? 'Edit' : 'Add New';
    switch (entityType) {
        case 'service-category': return `${action} ${context.audience} Category`;
        case 'service-sub-category': return `${action} Sub-Category for "${context.mainCategory?.name || ''}"`;
        case 'service-item': return `${action} Service`;
        default: return '';
    }
  };

  const renderFields = () => {
    switch(entityType) {
      case 'service-category':
        return <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Category Name (e.g., Hair)" className="p-2 border rounded w-full" required/>;
      case 'service-sub-category':
        return <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Sub-Category Name (e.g., Haircut)" className="p-2 border rounded w-full" required/>;
      case 'service-item':
        return (
          <div className="space-y-4">
            <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Service Name (e.g., Layered Cut)" className="p-2 border rounded w-full" required/>
            <div className="grid grid-cols-2 gap-4">
              <input name="price" type="number" step="0.01" value={formData.price || ''} onChange={handleChange} placeholder="Price" className="p-2 border rounded w-full" required/>
              <input name="duration" type="number" value={formData.duration || ''} onChange={handleChange} placeholder="Duration (mins)" className="p-2 border rounded w-full" required/>
            </div>
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2 text-gray-700">Consumables</h3>
              <div className="flex items-center gap-2">
                <input type="text" value={skuSearch} onChange={e => setSkuSearch(e.target.value)} placeholder="Search Product by SKU" className="p-2 border rounded w-full"/>
                <button type="button" onClick={handleAddConsumable} disabled={!foundProduct} className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-400">Add</button>
              </div>
              {foundProduct && <p className="text-sm text-green-600 mt-1">Found: {foundProduct.name}</p>}
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                {consumables.map((con, index) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-100 p-2 rounded-md">
                    <span className="flex-grow text-sm">{(con.product as IProduct).name}</span>
                    <input type="number" value={con.quantity} onChange={e => handleConsumableChange(index, 'quantity', parseFloat(e.target.value))} className="w-16 p-1 border rounded"/>
                    <input type="text" value={con.unit} onChange={e => handleConsumableChange(index, 'unit', e.target.value)} className="w-16 p-1 border rounded"/>
                    <button type="button" onClick={() => setConsumables(consumables.filter((_, i) => i !== index))}><TrashIcon className="h-5 w-5 text-red-500"/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400"><XMarkIcon className="h-6 w-6" /></button>
        <h2 className="text-2xl font-bold mb-6 capitalize">{getTitle()}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {renderFields()}
          <div className="flex justify-end gap-4 pt-4 border-t mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}