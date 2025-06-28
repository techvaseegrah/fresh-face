'use client';

import { useState, useEffect, FormEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { formatDateForInput } from '@/lib/utils';

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

  useEffect(() => {
    if (!isOpen) return;
    if (entityToEdit) {
      if (entityType === 'product') {
        setFormData({
          ...entityToEdit,
          expiryDate: entityToEdit.expiryDate ? formatDateForInput(new Date(entityToEdit.expiryDate)) : '',
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
          setFormData({ name: '', sku: '', price: '', quantity: '', unit: '', stockedDate: formatDateForInput(new Date()) });
          break;
      }
    }
  }, [isOpen, entityType, entityToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || '' : value }));
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
      if (entityType === 'subcategory') {
        payload.brand = context.brandId;
      }
      if (entityType === 'product') {
        payload.brand = context.brandId;
        payload.subCategory = context.subCategoryId;
      }
    }
    
    onSave(entityType, payload);
  };
  
  if (!isOpen) return null;
  
  const getTitle = () => { /* ... see previous code, it's correct ... */ };

  return (
    <div className="fixed inset-0 ...">
        {/* ... The rest of your modal JSX is correct ... */}
    </div>
  );
}