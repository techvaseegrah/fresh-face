'use client';

import { IProduct } from '@/models/Product';
import { IProductBrand } from '@/models/ProductBrand';
import { IProductSubCategory } from '@/models/ProductSubCategory';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { PlusIcon, PencilIcon, TrashIcon, ShoppingBagIcon, BuildingStorefrontIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import CategoryColumn from './CategoryColumn';
import EntityFormModal from './EntityFormModal';

type ProductType = 'Retail' | 'In-House';
type EntityType = 'brand' | 'subcategory' | 'product';


// A simple, reusable skeleton loader for columns
const ColumnSkeleton = () => (
  <div className="animate-pulse space-y-2 p-4">
    <div className="h-8 bg-gray-200 rounded-md w-3/4"></div>
    <div className="h-10 bg-gray-200 rounded-md"></div>
    <div className="h-10 bg-gray-200 rounded-md"></div>
    <div className="h-10 bg-gray-200 rounded-md"></div>
  </div>
);

export default function ProductManager() {
  const { data: session } = useSession();
  
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

  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_CREATE);
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_UPDATE);
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_DELETE);

  const resetSelections = useCallback(() => {
    setSelectedBrand(null);
    setSelectedSubCategoryId(null);
    setSubCategories([]);
    setProducts([]);
  }, []);

  const handleTypeChange = (newType: ProductType) => {
    if (newType === productType) return;
    setProductType(newType);
    resetSelections();
  };

  const fetchBrands = useCallback(async (type: ProductType) => {
    setIsLoadingBrands(true);
    const res = await fetch(`/api/product-brands?type=${type}`);
    const data = await res.json();
    setBrands(data.success ? data.data : []);
    setIsLoadingBrands(false);
  }, []);

  useEffect(() => {
    fetchBrands(productType);
  }, [productType, fetchBrands]);

  const fetchSubCategories = useCallback(async (brandId: string) => {
    setIsLoadingSubCategories(true);
    setProducts([]);
    setSelectedSubCategoryId(null);
    const res = await fetch(`/api/product-sub-categories?brandId=${brandId}`);
    const data = await res.json();
    setSubCategories(data.success ? data.data : []);
    setIsLoadingSubCategories(false);
  }, []);

  const fetchProducts = useCallback(async (subCategoryId: string) => {
    setIsLoadingProducts(true);
    const res = await fetch(`/api/products?subCategoryId=${subCategoryId}`);
    const data = await res.json();
    setProducts(data.success ? data.data : []);
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
    const paths: Record<EntityType, string> = {
      brand: 'product-brands',
      subcategory: 'product-sub-categories',
      product: 'products',
    };
    return paths[entityType] || '';
  };

  const handleSave = async (entityType: EntityType, data: any) => {
    const isEditing = !!entityToEdit;
    const id = isEditing ? entityToEdit._id : '';
    let payload = { ...data };

    if (!isEditing) {
      payload.type = productType;
      if (entityType === 'subcategory') payload.brand = selectedBrand?._id;
      if (entityType === 'product') {
        payload.brand = selectedBrand?._id;
        payload.subCategory = selectedSubCategoryId;
      }
    } else if (entityType === 'product') {
      payload.brand = payload.brand._id || payload.brand;
      payload.subCategory = payload.subCategory._id || payload.subCategory;
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
          if (entityType === 'brand') { resetSelections(); fetchBrands(productType); }
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

  const getStockColor = (stock: number, lowStock: number) => {
    if (stock <= 0) return 'text-red-600 bg-red-100';
    if (stock <= lowStock) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
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
      
      {/* Header with Product Type Toggle */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Product Inventory</h2>
          <div className="flex space-x-2 rounded-lg bg-gray-200 p-1">
            {([['Retail', ShoppingBagIcon], ['In-House', BuildingStorefrontIcon]] as [ProductType, React.ElementType][]).map(([type, Icon]) => (
              <button 
                key={type} 
                onClick={() => handleTypeChange(type)}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${productType === type ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-600 hover:bg-gray-300/50'}`}
              >
                <Icon className="h-5 w-5" />
                <span>{type}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content with 3-column layout */}
      <div className="flex-grow grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden">
        {/* Brands Column */}
        <div className="border-r border-gray-200 flex flex-col h-full">
          {isLoadingBrands ? <ColumnSkeleton /> : (
            <CategoryColumn
              title="Brands"
              items={brands}
              selectedId={selectedBrand?._id || null}
              onSelect={(id) => { const brand = brands.find(b => b._id === id); if (brand) handleSelectBrand(brand); }}
              onEdit={canUpdate ? (item) => handleOpenModal('brand', item) : undefined}
              onDelete={canDelete ? (id) => handleDelete('brand', id) : undefined}
              onAddNew={canCreate ? () => handleOpenModal('brand') : undefined}
              isLoading={isLoadingBrands}
            />
          )}
        </div>

        {/* Sub-Categories Column */}
        <div className="border-r border-gray-200 flex flex-col h-full">
          {isLoadingSubCategories ? <ColumnSkeleton /> : (
            <CategoryColumn
              title="Sub-Categories"
              items={subCategories}
              selectedId={selectedSubCategoryId}
              onSelect={handleSelectSubCategory}
              onEdit={canUpdate ? (item) => handleOpenModal('subcategory', item) : undefined}
              onDelete={canDelete ? (id) => handleDelete('subcategory', id) : undefined}
              onAddNew={canCreate ? () => handleOpenModal('subcategory') : undefined}
              isLoading={isLoadingSubCategories}
              disabled={!selectedBrand}
              disabledText="Select a brand to see its sub-categories."
            />
          )}
        </div>

        {/* Products Column */}
        <div className="flex flex-col w-full h-full bg-gray-50/50">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
            <h3 className="font-semibold text-lg text-gray-800">Products</h3>
            {canCreate && (
              <button 
                onClick={() => handleOpenModal('product')} 
                disabled={!selectedSubCategoryId} 
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <PlusIcon className="h-4 w-4" /> Add Product
              </button>
            )}
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-3">
            {isLoadingProducts && <div className="p-4 text-center text-gray-500">Loading products...</div>}
            {!isLoadingProducts && products.map(product => (
              <div key={product._id} className="group bg-white p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-base">{product.name}</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">SKU: {product.sku || 'N/A'}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <p><span className="font-medium">{product.numberOfItems}</span> items</p>
                      <p><span className="font-medium">{product.quantityPerItem}{product.unit}</span> / item</p>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-xl font-bold text-indigo-600">₹{product.price.toFixed(2)}</p>
                    <div className={`mt-1 px-2 py-0.5 rounded-full text-xs font-semibold inline-block ${getStockColor(product.totalQuantity, product.lowStockThreshold)}`}>
                      {product.totalQuantity}{product.unit} in stock
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-end mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Expires: {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : <span className="text-gray-400">No expiry</span>}
                  </p>
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canUpdate && (
                      <button onClick={() => handleOpenModal('product', product)} className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete('product', product._id)} className="p-1.5 rounded-full text-red-500 hover:bg-red-100">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!isLoadingProducts && products.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-500 bg-white rounded-lg border-2 border-dashed">
                <h4 className="font-semibold text-base text-gray-700">No Products to Display</h4>
                <p className="mt-1">{selectedSubCategoryId ? 'There are no products in this sub-category.' : selectedBrand ? 'Please select a sub-category to view its products.' : 'Please select a brand to get started.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}