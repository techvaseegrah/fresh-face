"use client"

import type { IProduct } from "@/models/Product"
import type { IProductBrand } from "@/models/ProductBrand"
import type { IProductSubCategory } from "@/models/ProductSubCategory"
import { useEffect, useState, useCallback } from "react"
import { useSession, getSession } from "next-auth/react"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CubeIcon,
  TagIcon,
  FolderOpenIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline"
import CategoryColumn from "./CategoryColumn"
import EntityFormModal from "./EntityFormModal"
import { toast } from "react-toastify"
import ProductImportModal from "./ProductImportModal"

type ProductType = "Retail" | "In-House"
type EntityType = "brand" | "subcategory" | "product"
type MobileView = "brands" | "subcategories" | "products"

export default function ProductManager() {
  const { data: session } = useSession()

  // --- All state and functions (no changes here) ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalEntityType, setModalEntityType] = useState<EntityType | null>(null)
  const [entityToEdit, setEntityToEdit] = useState<any | null>(null)
  const [productType, setProductType] = useState<ProductType>("Retail")
  const [brands, setBrands] = useState<IProductBrand[]>([])
  const [subCategories, setSubCategories] = useState<IProductSubCategory[]>([])
  const [products, setProducts] = useState<IProduct[]>([])
  const [selectedBrand, setSelectedBrand] = useState<IProductBrand | null>(null)
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null)
  const [activeMobileView, setActiveMobileView] = useState<MobileView>("brands")
  const [isLoadingBrands, setIsLoadingBrands] = useState(true)
  const [isLoadingSubCategories, setIsLoadingSubCategories] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_CREATE)
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_UPDATE)
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_DELETE)
  
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const session = await getSession();
    if (!session?.user?.tenantId) {
      throw new Error("Your session is invalid. Please log in again.");
    }
    const headers = { ...options.headers, 'x-tenant-id': session.user.tenantId };
    if (options.body) { (headers as any)['Content-Type'] = 'application/json'; }
    return fetch(url, { ...options, headers });
  }, []);

  const resetSelections = useCallback(() => {
    setSelectedBrand(null)
    setSelectedSubCategoryId(null)
    setSubCategories([])
    setProducts([])
    setActiveMobileView("brands")
  }, [])

  const fetchBrands = useCallback(async (type: ProductType) => {
    setIsLoadingBrands(true)
    resetSelections()
    try {
      const res = await tenantFetch(`/api/product-brands?type=${type}`)
      const data = await res.json()
      setBrands(data.success ? data.data : [])
    } catch (error: any) {
      toast.error(error.message || "Failed to load brands.")
      setBrands([])
    } finally {
      setIsLoadingBrands(false)
    }
  }, [resetSelections, tenantFetch])

  const fetchSubCategories = useCallback(async (brandId: string) => {
    setIsLoadingSubCategories(true)
    setSelectedSubCategoryId(null)
    setProducts([])
    try {
      const res = await tenantFetch(`/api/product-sub-categories?brandId=${brandId}`)
      const data = await res.json()
      setSubCategories(data.success ? data.data : [])
    } catch (error: any) {
      toast.error(error.message || "Failed to load sub-categories.")
      setSubCategories([])
    } finally {
      setIsLoadingSubCategories(false)
    }
  }, [tenantFetch])

  const fetchProducts = useCallback(async (subCategoryId: string) => {
    setIsLoadingProducts(true)
    setProducts([])
    try {
      const res = await tenantFetch(`/api/products?subCategoryId=${subCategoryId}`)
      const data = await res.json()
      setProducts(data.success ? data.data : [])
    } catch (error: any) {
      toast.error(error.message || "Failed to load products.")
      setProducts([])
    } finally {
      setIsLoadingProducts(false)
    }
  }, [tenantFetch])

  useEffect(() => { fetchBrands(productType) }, [productType, fetchBrands])

  const handleSelectBrand = (brand: IProductBrand) => {
    setSelectedBrand(brand)
    setActiveMobileView("subcategories")
    fetchSubCategories(brand._id)
  }

  const handleSelectSubCategory = (subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId)
    setActiveMobileView("products")
    fetchProducts(subCategoryId)
  }

  const handleOpenModal = (type: EntityType, entity: any | null = null) => {
    setModalEntityType(type)
    setEntityToEdit(entity)
    setIsModalOpen(true)
  }

  const handleImportSuccess = () => {
    toast.success("Import process finished. Refreshing data...")
    fetchBrands(productType)
  }

  const handleTypeChange = (newType: ProductType) => { if (newType !== productType) setProductType(newType) }

  const getApiPath = (entityType: EntityType) => ({
    brand: "product-brands", subcategory: "product-sub-categories", product: "products",
  })[entityType] || ""

  const handleSave = useCallback(async (entityType: EntityType, data: any) => {
    if (!entityType) return
    const isEditing = !!data._id
    const method = isEditing ? "PUT" : "POST"
    const apiPath = getApiPath(entityType)
    const url = isEditing ? `/api/${apiPath}/${data._id}` : `/api/${apiPath}`
    try {
      const res = await tenantFetch(url, { method, body: JSON.stringify(data) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || "An unknown error occurred.")
      toast.success(`'${data.name}' saved successfully!`)
      setIsModalOpen(false)
      if (entityType === "brand") fetchBrands(productType)
      else if (entityType === "subcategory" && selectedBrand) fetchSubCategories(selectedBrand._id)
      else if (entityType === "product" && selectedSubCategoryId) fetchProducts(selectedSubCategoryId)
    } catch (error: any) { toast.error(`Save failed: ${error.message}`) }
  }, [productType, selectedBrand, selectedSubCategoryId, fetchBrands, fetchSubCategories, fetchProducts, tenantFetch])

  const handleDelete = useCallback(async (entityType: EntityType, id: string) => {
    if (!entityType) return
    const entityName =
      (entityType === "brand" ? brands.find(b => b._id === id)?.name :
      entityType === "subcategory" ? subCategories.find(s => s._id === id)?.name :
      products.find(p => p._id === id)?.name) || "this item";
    if (!window.confirm(`Are you sure you want to delete '${entityName}'? This action cannot be undone.`)) return
    const apiPath = getApiPath(entityType)
    try {
      const res = await tenantFetch(`/api/${apiPath}/${id}`, { method: "DELETE" })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || "An unknown error occurred.")
      toast.success(`'${entityName}' deleted successfully!`)
      if (entityType === "brand") fetchBrands(productType)
      else if (entityType === "subcategory" && selectedBrand) fetchSubCategories(selectedBrand._id)
      else if (entityType === "product" && selectedSubCategoryId) fetchProducts(selectedSubCategoryId)
    } catch (error: any) { toast.error(`Delete failed: ${error.message}`) }
  }, [productType, selectedBrand, selectedSubCategoryId, brands, subCategories, products, fetchBrands, fetchSubCategories, fetchProducts, tenantFetch])

  return (
    // --- STYLING CHANGE: Replaced shadow with a border for a flatter, panel-like appearance ---
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
      <EntityFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} entityType={modalEntityType} entityToEdit={entityToEdit} context={{ productType, brandId: selectedBrand?._id, subCategoryId: selectedSubCategoryId, brandName: selectedBrand?.name, }} />
      <ProductImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImportSuccess={handleImportSuccess} />

      {/* --- STYLING CHANGE: Header layout adjusted to match screenshot --- */}
      <div className="flex-shrink-0 border-b border-slate-200 p-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CubeIcon className="h-5 w-5 text-slate-500" />
            <h1 className="text-lg font-semibold text-slate-800">Product Management</h1>
          </div>
          <div className="flex w-full items-stretch gap-2 sm:w-auto sm:flex-row">
            {/* --- STYLING CHANGE: Button toggle styled to match screenshot --- */}
            <div className="flex flex-grow rounded-md border border-slate-200 bg-slate-100 p-0.5">
              {(["Retail", "In-House"] as ProductType[]).map((type) => (
                <button key={type} onClick={() => handleTypeChange(type)} className={`w-full rounded-[5px] px-3 py-1.5 text-sm font-medium transition-all duration-200 ${productType === type ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-700"}`}>
                  {type}
                </button>
              ))}
            </div>
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-green-700">
              Import from Excel
            </button>
          </div>
        </div>
      </div>

      {/* --- STYLING CHANGE: Columns now use borders for separation, not shadows or cards --- */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Brands Column */}
        <div className={`flex w-full flex-col lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 ${activeMobileView === 'brands' ? 'block' : 'hidden'} lg:!flex`}>
          <CategoryColumn title="Brands" items={brands} selectedId={selectedBrand?._id || null} onSelect={(id) => { const brand = brands.find((b) => b._id === id); if (brand) handleSelectBrand(brand); }} onEdit={canUpdate ? (item) => handleOpenModal("brand", item) : undefined} onDelete={canDelete ? (id) => handleDelete("brand", id) : undefined} onAddNew={canCreate ? () => handleOpenModal("brand") : undefined} isLoading={isLoadingBrands} />
        </div>

        {/* Sub-Categories Column */}
        <div className={`flex w-full flex-col lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 ${activeMobileView === 'subcategories' ? 'block' : 'hidden'} lg:!flex`}>
          <CategoryColumn
            title="Sub-Categories"
            items={subCategories}
            selectedId={selectedSubCategoryId}
            onSelect={handleSelectSubCategory}
            onEdit={canUpdate ? (item) => handleOpenModal("subcategory", item) : undefined}
            onDelete={canDelete ? (id) => handleDelete("subcategory", id) : undefined}
            onAddNew={canCreate ? () => handleOpenModal("subcategory") : undefined}
            isLoading={isLoadingSubCategories}
            disabled={!selectedBrand}
            disabledText="Select a brand to view its sub-categories"
            onBack={() => setActiveMobileView("brands")}
          />
        </div>

        {/* Products Column */}
        <div className={`flex h-full w-full flex-col lg:w-1/3 ${activeMobileView === 'products' ? 'block' : 'hidden'} lg:!flex`}>
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveMobileView("subcategories")} className="lg:hidden rounded-md p-1.5 hover:bg-slate-100">
                <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
              </button>
              <h3 className="font-semibold text-slate-700">Products</h3>
            </div>
            {canCreate && (<button onClick={() => handleOpenModal("product")} disabled={!selectedSubCategoryId} className="rounded-md p-1.5 text-slate-400 transition-all hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30" title="Add new Product"><PlusIcon className="h-5 w-5" /></button>)}
          </div>
          {/* --- STYLING CHANGE: List background is now a light gray to match --- */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-2">
            {isLoadingProducts ? (
              <div className="flex h-full items-center justify-center"><div className="inline-flex items-center gap-2 text-slate-500"><div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div><span className="text-sm">Loading products...</span></div></div>
            ) : !selectedSubCategoryId ? (
              <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400">
                <FolderOpenIcon className="mb-2 h-10 w-10" />
                <p className="text-sm font-medium text-slate-500">No Sub-Category Selected</p>
                <p className="text-xs">Select a sub-category to view its products.</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400"><FolderOpenIcon className="mb-2 h-10 w-10" /><p className="font-medium text-slate-500">No Products Found</p><p className="text-xs">Click the '+' button above to add one.</p></div>
            ) : (
              <div className="space-y-1.5">
                {products.map((product) => (
                  // --- STYLING CHANGE: Simplified product item to a flat list item ---
                  <div key={product._id} className="group rounded-md border border-slate-200 bg-white p-3 transition-all duration-150 hover:border-blue-400 hover:shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-900">{product.name}</h4><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"><TagIcon className="h-3 w-3" />{product.sku}</span></div>
                        <div className="space-y-1 text-sm text-slate-600"><p><span className="font-medium">{product.numberOfItems} items</span> × {product.quantityPerItem}{product.unit} each</p><p className="font-medium text-blue-600">Total Stock: {product.totalQuantity}{product.unit}</p><p className="text-xs text-slate-500">Expires: {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : "N/A"}</p></div>
                      </div>
                      <div className="ml-4 flex-shrink-0 text-right">
                        <p className="text-lg font-bold text-green-600">₹{product.price.toFixed(2)}</p>
                        <div className="mt-2 flex justify-end gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                          {canUpdate && (<button onClick={() => handleOpenModal("product", product)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Edit product"><PencilIcon className="h-4 w-4" /></button>)}
                          {canDelete && (<button onClick={() => handleDelete("product", product._id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50" title="Delete product"><TrashIcon className="h-4 w-4" /></button>)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}