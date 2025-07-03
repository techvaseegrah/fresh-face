'use client';

import { useState, useEffect, FormEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { formatDateForInput } from '@/lib/utils';
import {IProduct} from '@/models/Product';


type EntityType = 'brand' | 'subcategory' | 'product';
type ProductType = 'Retail' | 'In-House';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entityType: EntityType, data: any) => void;
  entityType: EntityType | null;
  entityToEdit: any | null;
  context: {
    productType: ProductType;
    brandId?: string;
    subCategoryId?: string;
    brandName?: string;
  };
}

export default function ProductFormModal({ isOpen, onClose, onSave, entityType, entityToEdit, context }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [consumableOptions, setConsumableOptions] = useState<IProduct[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    if (entityToEdit) {
      if (entityType === 'product') {
        setFormData({
          ...entityToEdit,
          stockedDate: entityToEdit.stockedDate ? formatDateForInput(new Date(entityToEdit.stockedDate)) : '',
          expiryDate: entityToEdit.expiryDate ? formatDateForInput(new Date(entityToEdit.expiryDate)) : '',
          lowStockThreshold: entityToEdit.lowStockThreshold ?? 10,
        });
      } else {
        setFormData(entityToEdit);
      }
    } else {
      switch (entityType) {
        case 'brand':
        case 'subcategory':
          setFormData({ name: '' });
          break;
        case 'product':
          setFormData({
            name: '',
            sku: '',
            price: '',
            numberOfItems: '',
            quantityPerItem: '',
            unit: 'piece', // Defaulting to 'piece' as seen in screenshot
            stockedDate: formatDateForInput(new Date()),
            expiryDate: '',
            lowStockThreshold: 10,
          });
          break;
      }
    }
  }, [isOpen, entityType, entityToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isNumberInput = type === 'number';
    setFormData(prev => ({ ...prev, [name]: isNumberInput ? (value === '' ? '' : parseFloat(value)) : value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!entityType) return;
    let payload = { ...formData };
    if (entityToEdit) {
      payload._id = entityToEdit._id;
    }
    if (!entityToEdit) {
      payload.type = context.productType;
      if (entityType === 'subcategory') payload.brand = context.brandId;
      if (entityType === 'product') {
        payload.brand = context.brandId;
        payload.subCategory = context.subCategoryId;
      }
    }
    onSave(entityType, payload);
  };

  if (!isOpen) return null;

  const getTitle = () => {
    const action = entityToEdit ? 'Edit' : 'Add New';
    switch (entityType) {
      case 'brand': return `${action} Brand`;
      case 'subcategory': return `${action} Subcategory`;
      case 'product': return `${action} Product`;
      default: return '';
    }
  };
  console.log('Current entityType is:', entityType);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">{getTitle()}</h2>
          <button onClick={onClose} className="p-1"><XMarkIcon className="h-6 w-6 text-gray-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {(entityType === 'brand' || entityType === 'subcategory') && (
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" name="name" id="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required />
            </div>
          )}

          {entityType === 'product' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="col-span-1"><label htmlFor="name" className="block text-sm font-medium text-gray-700">Product Name</label><input type="text" name="name" id="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required /></div>
              <div className="col-span-1"><label htmlFor="sku" className="block text-sm font-medium text-gray-700">SKU</label><input type="text" name="sku" id="sku" value={formData.sku || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" /></div>
              <div className="col-span-1"><label htmlFor="price" className="block text-sm font-medium text-gray-700">Price</label><input type="number" name="price" id="price" value={formData.price || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required /></div>
              <div className="col-span-1"><label htmlFor="numberOfItems" className="block text-sm font-medium text-gray-700">Number of Items</label><input type="number" name="numberOfItems" id="numberOfItems" placeholder="e.g., 10 bottles" value={formData.numberOfItems || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required /></div>
              <div className="col-span-1"><label htmlFor="quantityPerItem" className="block text-sm font-medium text-gray-700">Quantity Per Item</label><input type="number" name="quantityPerItem" id="quantityPerItem" placeholder="e.g., 100 ml per bottle" value={formData.quantityPerItem || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required /></div>
              <div className="col-span-1"><label htmlFor="unit" className="block text-sm font-medium text-gray-700">Unit</label><select name="unit" id="unit" value={formData.unit || 'piece'} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required><option value="piece">piece</option><option value="ml">ml</option><option value="g">g</option><option value="kg">kg</option><option value="l">l</option></select></div>
              <div className="col-span-1"><label htmlFor="stockedDate" className="block text-sm font-medium text-gray-700">Stocked Date</label><input type="date" name="stockedDate" id="stockedDate" value={formData.stockedDate || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required /></div>
              <div className="col-span-1"><label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">Expiry Date (Optional)</label><input type="date" name="expiryDate" id="expiryDate" value={formData.expiryDate || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" /></div>
              
              {/* === THIS IS THE NEW FIELD, NOW CORRECTLY PLACED === */}
              <div className="col-span-2 pt-2">
                <label htmlFor="lowStockThreshold" className="block text-sm font-medium text-gray-700">Low Stock Threshold</label>
                <p className="text-xs text-gray-500 mb-1">Send an alert when the number of items is at or below this value.</p>
                <input type="number" name="lowStockThreshold" id="lowStockThreshold" value={formData.lowStockThreshold || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" min="0" required />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-6 border-t mt-6">
            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md mr-3 font-semibold">Cancel</button>
            <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-md font-semibold">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}