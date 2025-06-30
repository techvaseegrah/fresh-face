// components/admin/ServiceFormModal.tsx (Updated)
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { IProduct } from '@/models/Product';
import { IServiceConsumable } from '@/models/ServiceItem';
import { useDebounce } from '@/hooks/useDebounce';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { IServiceCategory } from '@/models/ServiceCategory';

type EntityType = 'service-category' | 'service-sub-category' | 'service-item';
type AudienceType = 'male' | 'female' | 'Unisex';

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

// Updated interface for form consumables
interface FormConsumable {
  product: IProduct;
  quantity: {
    male?: number;
    female?: number;
    default: number;
  };
  unit: string;
}

export default function ServiceFormModal({ isOpen, onClose, onSave, entityType, entityToEdit, context }: Props) {
  const [formData, setFormData] = useState<any>({});
  const [consumables, setConsumables] = useState<FormConsumable[]>([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [foundProduct, setFoundProduct] = useState<IProduct | null>(null);
  const debouncedSku = useDebounce(skuSearch, 300);

  useEffect(() => {
    if (isOpen) {
      if (entityToEdit) {
        setFormData(entityToEdit);
        if (entityType === 'service-item') {
          // Convert existing consumables to form format
          const formattedConsumables = (entityToEdit.consumables || []).map((c: any) => ({
            product: c.product,
            quantity: {
              male: c.quantity?.male,
              female: c.quantity?.female,
              default: c.quantity?.default || c.quantity || 1
            },
            unit: c.unit || 'pcs'
          }));
          setConsumables(formattedConsumables);
        }
      } else {
        setFormData({}); 
        setConsumables([]);
      }
      setSkuSearch(''); 
      setFoundProduct(null);
    }
  }, [entityToEdit, isOpen, entityType]);
  
  useEffect(() => {
    if (debouncedSku.trim()) {
      fetch(`/api/products?sku=${debouncedSku.toUpperCase()}`)
        .then(res => res.json())
        .then(data => { 
          setFoundProduct(data.success && data.data.length > 0 ? data.data[0] : null); 
        });
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
    
    const newConsumable: FormConsumable = { 
      product: foundProduct, 
      quantity: {
        default: 1
      },
      unit: foundProduct.unit || 'pcs' 
    };
    
    setConsumables([...consumables, newConsumable]);
    setSkuSearch(''); 
    setFoundProduct(null);
  };
  
  const handleConsumableChange = (index: number, field: string, value: string | number) => {
    const updated = [...consumables];
    
    if (field.startsWith('quantity.')) {
      const quantityField = field.split('.')[1] as 'male' | 'female' | 'default';
      updated[index] = { 
        ...updated[index], 
        quantity: {
          ...updated[index].quantity,
          [quantityField]: value === '' ? undefined : Number(value)
        }
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
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
      payload.consumables = consumables.map(c => ({
        product: c.product._id,
        quantity: {
          ...(c.quantity.male !== undefined && { male: c.quantity.male }),
          ...(c.quantity.female !== undefined && { female: c.quantity.female }),
          default: c.quantity.default
        },
        unit: c.unit
      }));
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

  const renderConsumableFields = () => {
    if (entityType !== 'service-item') return null;

    return (
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2 text-gray-700">Product Consumables</h3>
        <p className="text-sm text-gray-600 mb-3">
          Set gender-specific quantities for products used in this service. Default quantity is used when gender-specific amounts aren't available.
        </p>
        
        <div className="flex items-center gap-2 mb-4">
          {/* --- FIX APPLIED HERE --- */}
          <input 
            type="text" 
            value={skuSearch} 
            // 1. This converts the typed value to uppercase before setting the state.
            onChange={e => setSkuSearch(e.target.value.toUpperCase())} 
            placeholder="Search Product by SKU" 
            className="p-2 border rounded w-full"
            // 2. This style overrides any external CSS that might force the text to appear lowercase.
            style={{ textTransform: 'uppercase' }}
          />
          <button 
            type="button" 
            onClick={handleAddConsumable} 
            disabled={!foundProduct} 
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-400"
          >
            Add
          </button>
        </div>
        
        {foundProduct && (
          <p className="text-sm text-green-600 mb-4">
            Found: {foundProduct.name} ({foundProduct.quantityPerItem}{foundProduct.unit} per item)
          </p>
        )}
        
        <div className="space-y-4 max-h-60 overflow-y-auto">
          {consumables.map((con, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-medium text-sm">{con.product.name}</span>
                  <div className="text-xs text-gray-500">
                    SKU: {con.product.sku} | Available: {con.product.quantity}{con.product.unit}
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setConsumables(consumables.filter((_, i) => i !== index))}
                  className="text-red-500 hover:text-red-700"
                >
                  <TrashIcon className="h-5 w-5"/>
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-3 items-end">
                {/* Default Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Default Qty <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="number" 
                    value={con.quantity.default || ''} 
                    onChange={e => handleConsumableChange(index, 'quantity.default', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border rounded text-sm"
                    min="0"
                    step="0.1"
                    required
                  />
                </div>
                
                {/* Male Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Male Qty
                  </label>
                  <input 
                    type="number" 
                    value={con.quantity.male || ''} 
                    onChange={e => handleConsumableChange(index, 'quantity.male', e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                    min="0"
                    step="0.1"
                    placeholder="Optional"
                  />
                </div>
                
                {/* Female Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Female Qty
                  </label>
                  <input 
                    type="number" 
                    value={con.quantity.female || ''} 
                    onChange={e => handleConsumableChange(index, 'quantity.female', e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                    min="0"
                    step="0.1"
                    placeholder="Optional"
                  />
                </div>
                
                {/* Unit */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <input 
                    type="text" 
                    value={con.unit} 
                    onChange={e => handleConsumableChange(index, 'unit', e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                    placeholder="ml, pcs, etc."
                  />
                </div>
              </div>
              
              {/* Usage Preview */}
              <div className="mt-3 text-xs text-gray-600 bg-white p-2 rounded border">
                <div className="font-medium mb-1">Usage Preview:</div>
                <div className="grid grid-cols-4 gap-2">
                  <div>Default: {con.quantity.default || 0}{con.unit}</div>
                  <div>Male: {con.quantity.male || con.quantity.default || 0}{con.unit}</div>
                  <div>Female: {con.quantity.female || con.quantity.default || 0}{con.unit}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFields = () => {
    switch(entityType) {
      case 'service-category':
        return (
          <input 
            name="name" 
            value={formData.name || ''} 
            onChange={handleChange} 
            placeholder="Category Name (e.g., Hair)" 
            className="p-2 border rounded w-full" 
            required
          />
        );
        
      case 'service-sub-category':
        return (
          <input 
            name="name" 
            value={formData.name || ''} 
            onChange={handleChange} 
            placeholder="Sub-Category Name (e.g., Haircut)" 
            className="p-2 border rounded w-full" 
            required
          />
        );
        
      case 'service-item':
        return (
          <div className="space-y-4">
            <input 
              name="name" 
              value={formData.name || ''} 
              onChange={handleChange} 
              placeholder="Service Name (e.g., Layered Cut)" 
              className="p-2 border rounded w-full" 
              required
            />
            
            <div className="grid grid-cols-3 gap-4">
              <input 
                name="price" 
                type="number" 
                step="0.01" 
                value={formData.price || ''} 
                onChange={handleChange} 
                placeholder="Price" 
                className="p-2 border rounded w-full" 
                required
              />
              <input 
                name="membershipRate" 
                type="number" 
                step="0.01" 
                value={formData.membershipRate || ''} 
                onChange={handleChange} 
                placeholder="Member Price (Optional)" 
                className="p-2 border rounded w-full"
              />
              <input 
                name="duration" 
                type="number" 
                value={formData.duration || ''} 
                onChange={handleChange} 
                placeholder="Duration (mins)" 
                className="p-2 border rounded w-full" 
                required
              />
            </div>
            
            {renderConsumableFields()}
          </div>
        );
        
      default: 
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400">
          <XMarkIcon className="h-6 w-6" />
        </button>
        
        <h2 className="text-2xl font-bold mb-6 capitalize">{getTitle()}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {renderFields()}
          
          <div className="flex justify-end gap-4 pt-4 border-t mt-6">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-black text-white rounded-lg"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}