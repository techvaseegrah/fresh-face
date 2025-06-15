// src/components/admin/EntityFormModal.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { IProduct } from '@/models/Product';
import { formatDateForInput } from '@/lib/utils';

type EntityType = 'brand' | 'subcategory' | 'product';
type ProductType = 'Retail' | 'In-House';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entityType: EntityType, data: any) => void;
  entityType: EntityType | null;
  entityToEdit: IProduct | { _id: string; name: string; } | null;
  context?: {
    productType?: ProductType;
    brandId?: string;
    subCategoryId?: string;
    brandName?: string;
  };
}

const getNewProductFormState = () => ({
  name: '', sku: '', quantity: '', unit: '',
  price: '', // --- NEW: Added price to initial state ---
  stockedDate: formatDateForInput(new Date()),
  expiryDate: '',
});

export default function EntityFormModal({ isOpen, onClose, onSave, entityType, entityToEdit, context }: Props) {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (!isOpen) { setFormData({}); return; }
    if (entityToEdit) {
      if (entityType === 'product') {
        const productToEdit = entityToEdit as IProduct;
        const expiry = productToEdit.expiryDate ? new Date(productToEdit.expiryDate) : null;
        setFormData({
          ...productToEdit,
          brand: productToEdit.brand?._id,
          subCategory: productToEdit.subCategory?._id,
          expiryDate: expiry ? formatDateForInput(expiry) : '',
        });
      } else {
        setFormData({ name: entityToEdit.name || '' });
      }
    } else {
      switch (entityType) {
        case 'brand': case 'subcategory': setFormData({ name: '' }); break;
        case 'product': setFormData(getNewProductFormState()); break;
        default: setFormData({}); break;
      }
    }
  }, [isOpen, entityType, entityToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!entityType) return;
    
    let dataToSave: any;

    if (entityType === 'product') {
      dataToSave = {
        name: formData.name,
        sku: formData.sku,
        price: parseFloat(formData.price) || 0, // --- NEW: Parse price to a number ---
        quantity: parseInt(formData.quantity, 10) || 0,
        unit: formData.unit,
        stockedDate: new Date(formData.stockedDate),
        type: context?.productType,
        brand: context?.brandId,
        subCategory: context?.subCategoryId,
      };
      if (formData.expiryDate) {
        dataToSave.expiryDate = new Date(formData.expiryDate);
      }
      if (entityToEdit) {
        dataToSave._id = (entityToEdit as IProduct)._id;
      }
    } else {
      dataToSave = { name: formData.name, type: context?.productType };
      if (entityType === 'subcategory') { dataToSave.brand = context?.brandId; }
      if (entityToEdit) { dataToSave._id = entityToEdit._id; }
    }
    onSave(entityType, dataToSave);
  };
  
  if (!isOpen) return null;

  const getTitle = () => { /* ... same as before ... */ };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4"><XMarkIcon className="h-6 w-6 text-gray-500" /></button>
        <h2 className="text-2xl font-bold mb-6">{getTitle()}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(entityType === 'brand' || entityType === 'subcategory') && ( <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Name" className="p-2 border rounded-md border-gray-300 w-full" required autoFocus/> )}

          {entityType === 'product' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Product Name" className="p-2 border rounded-md" required />
              <input name="sku" value={formData.sku || ''} onChange={handleChange} placeholder="SKU" className="p-2 border rounded-md" required />
              {/* --- NEW: Price input field --- */}
              <input name="price" type="number" step="0.01" value={formData.price || ''} onChange={handleChange} placeholder="Price" className="p-2 border rounded-md" required />
              <input name="quantity" type="number" value={formData.quantity || ''} onChange={handleChange} placeholder="Quantity" className="p-2 border rounded-md" required />
              <input name="unit" value={formData.unit || ''} onChange={handleChange} placeholder="Unit (e.g., ml, pcs)" className="p-2 border rounded-md" required />
              <div className="relative">
                <label className="text-xs text-gray-500 absolute -top-2 left-2 bg-white px-1">Stocked Date</label>
                <input name="stockedDate" type="date" value={formData.stockedDate || ''} onChange={handleChange} className="p-2 border rounded-md w-full" required />
              </div>
              <div className="relative md:col-span-2">
                <label className="text-xs text-gray-500 absolute -top-2 left-2 bg-white px-1">Expiry Date (Optional)</label>
                <input name="expiryDate" type="date" value={formData.expiryDate || ''} onChange={handleChange} className="p-2 border rounded-md w-full" />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Keep the getTitle function as it is
const getTitle = ({ entityType, entityToEdit, context }: Pick<Props, 'entityType' | 'entityToEdit' | 'context'>) => {
    const action = entityToEdit ? 'Edit' : 'Add New';
    switch (entityType) {
        case 'brand': return `${action} ${context?.productType} Brand`;
        case 'subcategory': return `${action} Sub-Category for ${context?.brandName || 'Brand'}`;
        case 'product': return `${action} Product`;
        default: return '';
    }
};