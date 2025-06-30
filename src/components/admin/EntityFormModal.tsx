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
  entityToEdit: IProduct | { _id: string; name:string; } | null;
  context?: {
    productType?: ProductType;
    brandId?: string;
    subCategoryId?: string;
    brandName?: string;
  };
}

const getNewProductFormState = () => ({
  name: '',
  sku: '',
  numberOfItems: '',
  quantityPerItem: '',
  unit: 'piece', // Default to piece
  price: '',
  stockedDate: formatDateForInput(new Date()),
  expiryDate: '',
});

export default function EntityFormModal({ isOpen, onClose, onSave, entityType, entityToEdit, context }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);

  // FIX: Standardized unit options for dropdown
  const unitOptions = ['piece', 'ml', 'l', 'g', 'kg'];

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

  useEffect(() => {
    if (entityType === 'product') {
      const items = parseFloat(formData.numberOfItems) || 0;
      const perItem = parseFloat(formData.quantityPerItem) || 0;
      setCalculatedTotal(items * perItem);
    }
  }, [formData.numberOfItems, formData.quantityPerItem, entityType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // *** MODIFICATION 1: CHECK FOR SKU AND CONVERT TO UPPERCASE ***
    if (name === 'sku') {
      setFormData((prev: any) => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!entityType) return;
    
    let dataToSave: any;

    if (entityType === 'product') {
      dataToSave = {
        name: formData.name,
        // The SKU is already uppercase here because of our handleChange modification
        sku: formData.sku,
        price: parseFloat(formData.price) || 0,
        numberOfItems: parseInt(formData.numberOfItems, 10) || 0,
        quantityPerItem: parseFloat(formData.quantityPerItem) || 0,
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

  const getTitle = () => {
    const action = entityToEdit ? 'Edit' : 'Add New';
    switch (entityType) {
      case 'brand': return `${action} ${context?.productType} Brand`;
      case 'subcategory': return `${action} Sub-Category for ${context?.brandName || 'Brand'}`;
      case 'product': return `${action} Product`;
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4"><XMarkIcon className="h-6 w-6 text-gray-500" /></button>
        <h2 className="text-xl font-bold mb-4">{getTitle()}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {(entityType === 'brand' || entityType === 'subcategory') && (
            <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Name" className="p-2 border rounded-md border-gray-300 w-full" required autoFocus />
          )}

          {entityType === 'product' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Product Name" className="p-2 border rounded-md" required />
                {/* *** MODIFICATION 2: ADDED 'uppercase' CLASS FOR VISUAL FEEDBACK *** */}
                <input name="sku" value={formData.sku || ''} onChange={handleChange} placeholder="SKU" className="p-2 border rounded-md uppercase" required />
                <input name="price" type="number" step="0.01" value={formData.price || ''} onChange={handleChange} placeholder="Price" className="p-2 border rounded-md" required />
                <div className="relative">
                  <label className="text-xs text-gray-500 absolute -top-2 left-2 bg-white px-1">Number of Items</label>
                  <input name="numberOfItems" type="number" value={formData.numberOfItems || ''} onChange={handleChange} placeholder="e.g., 10 bottles" className="p-2 border rounded-md w-full" required />
                </div>
                <div className="relative">
                  <label className="text-xs text-gray-500 absolute -top-2 left-2 bg-white px-1">Quantity Per Item</label>
                  <input name="quantityPerItem" type="number" step="any" value={formData.quantityPerItem || ''} onChange={handleChange} placeholder="e.g., 100 ml per bottle" className="p-2 border rounded-md w-full" required />
                </div>
                {/* FIX: Changed to a select dropdown */}
                <div className="relative">
                  <label className="text-xs text-gray-500 absolute -top-2 left-2 bg-white px-1">Unit</label>
                  <select name="unit" value={formData.unit || ''} onChange={handleChange} className="p-2 border rounded-md w-full" required >
                    <option value="" disabled>Select Unit</option>
                    {unitOptions.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <label className="text-xs text-gray-500 absolute -top-2 left-2 bg-white px-1">Stocked Date</label>
                  <input name="stockedDate" type="date" value={formData.stockedDate || ''} onChange={handleChange} className="p-2 border rounded-md w-full" required />
                </div>
                <div className="relative md:col-span-2">
                  <label className="text-xs text-gray-500 absolute -top-2 left-2 bg-white px-1">Expiry Date (Optional)</label>
                  <input name="expiryDate" type="date" value={formData.expiryDate || ''} onChange={handleChange} className="p-2 border rounded-md w-full" />
                </div>
              </div>
              {calculatedTotal > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-800">
                    <strong>Total Inventory:</strong> {calculatedTotal} {formData.unit || 'units'}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {formData.numberOfItems || 0} items × {formData.quantityPerItem || 0} {formData.unit || 'units'} each = {calculatedTotal} {formData.unit || 'units'}
                  </div>
                </div>
              )}
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