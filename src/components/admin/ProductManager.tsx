'use client';

import { IProduct } from '@/models/Product';
import { IProductBrand } from '@/models/ProductBrand';
import { IProductSubCategory } from '@/models/ProductSubCategory';
import { useEffect, useState, useCallback } from 'react';
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import CategoryColumn from './CategoryColumn';
import EntityFormModal from './EntityFormModal'; // This is the single, flexible modal used.

type ProductType = 'Retail' | 'In-House';
type EntityType = 'brand' | 'subcategory' | 'product';

export default function ProductManager() {
  const [productType, setProductType] = useState<ProductType>('Retail');
  const [brands, setBrands] = useState<IProductBrand[]>([]);
  const [subCategories, setSubCategories] = useState<IProductSubCategory[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);

  const [selectedBrand, setSelectedBrand] = useState<IProductBrand | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);

  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isLoadingSubCategories, setIsLoadingSubCategories] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEntityType, setModalEntityType] = useState<EntityType | null>(null);
  const [entityToEdit, setEntityToEdit] = useState<any | null>(null);

  const resetSelections = () => {
    setSelectedBrand(null);
    setSelectedSubCategoryId(null);
    setSubCategories([]);
    setProducts([]);
  };

  const handleTypeChange = (newType: ProductType) => {
    if (newType === productType) return;
    setProductType(newType);
  };

  const fetchBrands = useCallback(async (type: ProductType) => {
    setIsLoadingBrands(true);
    resetSelections();
    const res = await fetch(`/api/product-brands?type=${type}`);
    const data = await res.json();
    if (data.success) {
      setBrands(data.data);
    } else {
      setBrands([]);
    }
    setIsLoadingBrands(false);
  }, []);

  useEffect(() => {
    fetchBrands(productType);
  }, [productType, fetchBrands]);

  const fetchSubCategories = useCallback(async (brandId: string) => {
    setIsLoadingSubCategories(true);
    setSelectedSubCategoryId(null);
    setProducts([]);
    const res = await fetch(`/api/product-sub-categories?brandId=${brandId}`);
    const data = await res.json();
    if (data.success) {
      setSubCategories(data.data);
    } else {
      setSubCategories([]);
    }
    setIsLoadingSubCategories(false);
  }, []);

  const fetchProducts = useCallback(async (subCategoryId: string) => {
    setIsLoadingProducts(true);
    setProducts([]);
    const res = await fetch(`/api/products?subCategoryId=${subCategoryId}`);
    const data = await res.json();
    if (data.success) {
      setProducts(data.data);
    } else {
      setProducts([]);
    }
    setIsLoadingProducts(false);
  }, []);

  const handleSelectBrand = (brand: IProductBrand) => {
    setSelectedBrand(brand);
    fetchSubCategories(brand._id);
  };

  const handleSelectSubCategory = (subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId);
    fetchProducts(subCategoryId);
  };

  const handleOpenModal = (type: EntityType, entity: any | null = null) => {
    setModalEntityType(type);
    setEntityToEdit(entity);
    setIsModalOpen(true);
  };

  const getApiPath = (entityType: EntityType) => {
    if (entityType === 'brand') return 'product-brands';
    if (entityType === 'subcategory') return 'product-sub-categories';
    if (entityType === 'product') return 'products';
    return '';
  };
  const handleSave = async (entityType: EntityType, data: any) => {
    const isEditing = !!entityToEdit;
    const id = isEditing ? entityToEdit._id : '';
    let payload = { ...data };

    if (!isEditing) {
      payload.type = productType;
      if (entityType === 'subcategory') {
        payload.brand = selectedBrand?._id;
      }
      if (entityType === 'product') {
        payload.brand = selectedBrand?._id;
        payload.subCategory = selectedSubCategoryId;
      }
    } else {
      if (entityType === 'product') {
        payload.brand = payload.brand._id || payload.brand;
        payload.subCategory = payload.subCategory._id || payload.subCategory;
      }
    }

    const apiPath = getApiPath(entityType);
    if (!apiPath) return;

    const url = isEditing ? `/api/${apiPath}/${id}` : `/api/${apiPath}`;
    try {
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEntityToEdit(null);
        if (entityType === 'brand') fetchBrands(productType);
        if (entityType === 'subcategory' && selectedBrand) fetchSubCategories(selectedBrand._id);
        if (entityType === 'product' && selectedSubCategoryId) fetchProducts(selectedSubCategoryId);
      } else {
        const errorData = await res.json();
        alert(`Failed to save: ${errorData.error || 'Unknown server error'}`);
      }
    } catch (error) {
      console.error('Save operation failed:', error);
      alert('An error occurred. Check the console for details.');
    }
  };

  const handleDelete = async (entityType: EntityType, id: string) => {
    const apiPath = getApiPath(entityType);
    if (!apiPath) return;
    if (confirm(`Are you sure you want to delete this ${entityType}?`)) {
      try {
        const res = await fetch(`/api/${apiPath}/${id}`, { method: 'DELETE' });
        if (res.ok) {
          if (entityType === 'brand') fetchBrands(productType);
          if (entityType === 'subcategory' && selectedBrand) { setSelectedSubCategoryId(null); setProducts([]); fetchSubCategories(selectedBrand._id); }
          if (entityType === 'product' && selectedSubCategoryId) fetchProducts(selectedSubCategoryId);
        } else {
          const errorData = await res.json();
          alert(`Failed to delete: ${errorData.error}`);
        }
      } catch (error) {
        console.error('Delete operation failed:', error);
        alert('An error occurred. Check the console for details.');
      }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <EntityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        entityType={modalEntityType}
        entityToEdit={entityToEdit}
        context={{
          productType: productType,
          brandId: selectedBrand?._id,
          subCategoryId: selectedSubCategoryId,
          brandName: selectedBrand?.name,
        }}
      />
      <div className="p-4 border-b border-gray-200">
        <div className="flex space-x-2 rounded-md bg-gray-100 p-1 w-min">
          {(['Retail', 'In-House'] as ProductType[]).map((type) => (
            <button key={type} onClick={() => handleTypeChange(type)}
              className={`px-6 py-1.5 text-sm font-medium rounded-md transition-colors ${productType === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >{type} Products</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col md:flex-row h-[calc(100vh-250px)] bg-gray-50 overflow-hidden">
        <CategoryColumn title="Brands" items={brands} selectedId={selectedBrand?._id || null}
          onSelect={(id) => { const brand = brands.find(b => b._id === id); if (brand) handleSelectBrand(brand); }}
          onEdit={(item) => handleOpenModal('brand', item)}
          onDelete={(id) => handleDelete('brand', id)}
          onAddNew={() => handleOpenModal('brand')}
          isLoading={isLoadingBrands}
        />
        <CategoryColumn title="Sub-Categories" items={subCategories} selectedId={selectedSubCategoryId}
          onSelect={handleSelectSubCategory}
          onEdit={(item) => handleOpenModal('subcategory', item)}
          onDelete={(id) => handleDelete('subcategory', id)}
          onAddNew={() => handleOpenModal('subcategory')}
          isLoading={isLoadingSubCategories} disabled={!selectedBrand}
        />

        <div className="flex flex-col w-full md:w-1/3 bg-white">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-lg text-gray-800">Products</h3>
            <button onClick={() => handleOpenModal('product')} disabled={!selectedSubCategoryId} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-black rounded-md disabled:bg-gray-300">
              <PlusIcon className="h-4 w-4" /> Add Product
            </button>
          </div>

<div className="flex-grow overflow-y-auto">
  {isLoadingProducts && <div className="p-4 text-center text-gray-500">Loading...</div>}
  {products.map(product => (
    <div key={product._id} className="group p-4 border-b hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-gray-800">{product.name}</p>
          <p className="text-xs text-gray-500 font-mono mt-1">SKU: {product.sku}</p>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-medium">{product.numberOfItems} items</span> × {product.quantityPerItem}{product.unit} each
          </p>
          <p className="text-sm text-blue-600 font-medium mt-1">
            Total Stock: {product.totalQuantity}{product.unit}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Expires: {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : <span className="text-gray-400">N/A</span>}
          </p>
        </div>
        <div className="text-right ml-4">
          <p className="text-lg font-semibold text-gray-900">₹{product.price.toFixed(2)}</p>
          <div className="flex justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100">
            <button onClick={() => handleOpenModal('product', product)} className="p-1.5 rounded hover:bg-gray-200">
              <PencilIcon className="h-5 w-5" />
            </button>
            <button onClick={() => handleDelete('product', product._id)} className="p-1.5 rounded text-red-500 hover:bg-red-100">
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  ))}
  {!isLoadingProducts && products.length === 0 && (
    <div className="p-8 text-center text-sm text-gray-400">
      {selectedSubCategoryId ? 'No products found.' : 'Select a sub-category.'}
    </div>
  )}
</div>
        </div>
      </div>
    </div>
  );
}