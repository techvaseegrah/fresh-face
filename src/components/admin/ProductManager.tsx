"use client"

import type { IProduct } from "@/models/Product"
import type { IProductBrand } from "@/models/ProductBrand"
import type { IProductSubCategory } from "@/models/ProductSubCategory"
import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { PlusIcon, PencilIcon, TrashIcon, CubeIcon, TagIcon } from "@heroicons/react/24/outline"
import CategoryColumn from "./CategoryColumn"
import EntityFormModal from "./EntityFormModal"
import { toast } from "react-toastify"
import ProductImportModal from "./ProductImportModal"

type ProductType = "Retail" | "In-House"
type EntityType = "brand" | "subcategory" | "product"

export default function ProductManager() {
  const { data: session } = useSession()

    const [isImportModalOpen, setIsImportModalOpen] = useState(false); // <-- ADD NEW STATE


  const [productType, setProductType] = useState<ProductType>("Retail")
  const [brands, setBrands] = useState<IProductBrand[]>([])
  const [subCategories, setSubCategories] = useState<IProductSubCategory[]>([])
  const [products, setProducts] = useState<IProduct[]>([])

  const [selectedBrand, setSelectedBrand] = useState<IProductBrand | null>(null)
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null)

  const [isLoadingBrands, setIsLoadingBrands] = useState(true)
  const [isLoadingSubCategories, setIsLoadingSubCategories] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalEntityType, setModalEntityType] = useState<EntityType | null>(null)
  const [entityToEdit, setEntityToEdit] = useState<any | null>(null)

  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_CREATE)
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_UPDATE)
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_DELETE)

  const resetSelections = () => {
    setSelectedBrand(null)
    setSelectedSubCategoryId(null)
    setSubCategories([])
    setProducts([])
  }

    const handleImportSuccess = (report: any) => {
    const successMessage = `
      Import complete! 
      ${report.successfulImports} successful. 
      ${report.failedImports} failed.
      ${report.newBrands.length} new brands created.
      ${report.newSubCategories.length} new sub-categories created.
    `;
    toast.success(successMessage);

    // If there were errors, show them in the console or a more detailed modal
    if (report.failedImports > 0) {
      console.error("Import Errors:", report.errors);
      toast.error("Some rows failed to import. Check the console for details.");
    }
    
    // Refresh the view
    fetchBrands(productType);
  };


  const handleTypeChange = (newType: ProductType) => {
    if (newType === productType) return
    setProductType(newType)
  }

  const fetchBrands = useCallback(async (type: ProductType) => {
    setIsLoadingBrands(true)
    resetSelections()
    const res = await fetch(`/api/product-brands?type=${type}`)
    const data = await res.json()
    if (data.success) {
      setBrands(data.data)
    } else {
      setBrands([])
    }
    setIsLoadingBrands(false)
  }, [])

  useEffect(() => {
    fetchBrands(productType)
  }, [productType, fetchBrands])

  const fetchSubCategories = useCallback(async (brandId: string) => {
    setIsLoadingSubCategories(true)
    setSelectedSubCategoryId(null)
    setProducts([])
    const res = await fetch(`/api/product-sub-categories?brandId=${brandId}`)
    const data = await res.json()
    if (data.success) {
      setSubCategories(data.data)
    } else {
      setSubCategories([])
    }
    setIsLoadingSubCategories(false)
  }, [])

  const fetchProducts = useCallback(async (subCategoryId: string) => {
    setIsLoadingProducts(true)
    setProducts([])
    const res = await fetch(`/api/products?subCategoryId=${subCategoryId}`)
    const data = await res.json()
    if (data.success) {
      setProducts(data.data)
    } else {
      setProducts([])
    }
    setIsLoadingProducts(false)
  }, [])

  const handleSelectBrand = (brand: IProductBrand) => {
    setSelectedBrand(brand)
    fetchSubCategories(brand._id)
  }

  const handleSelectSubCategory = (subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId)
    fetchProducts(subCategoryId)
  }

  const handleOpenModal = (type: EntityType, entity: any | null = null) => {
    setModalEntityType(type)
    setEntityToEdit(entity)
    setIsModalOpen(true)
  }

  const getApiPath = (entityType: EntityType) => {
    if (entityType === "brand") return "product-brands"
    if (entityType === "subcategory") return "product-sub-categories"
    if (entityType === "product") return "products"
    return ""
  }

  const handleSave = async (entityType: EntityType, data: any) => {
    const isEditing = !!entityToEdit
    const id = isEditing ? entityToEdit._id : ""
    const payload = { ...data }

    if (!isEditing) {
      payload.type = productType
      if (entityType === "subcategory") {
        payload.brand = selectedBrand?._id
      }
      if (entityType === "product") {
        payload.brand = selectedBrand?._id
        payload.subCategory = selectedSubCategoryId
      }
    } else {
      if (entityType === "product") {
        payload.brand = payload.brand._id || payload.brand
        payload.subCategory = payload.subCategory._id || payload.subCategory
      }
    }

    const apiPath = getApiPath(entityType)
    if (!apiPath) return

    const url = isEditing ? `/api/${apiPath}/${id}` : `/api/${apiPath}`
    try {
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setIsModalOpen(false)
        setEntityToEdit(null)
        if (entityType === "brand") fetchBrands(productType)
        if (entityType === "subcategory" && selectedBrand) fetchSubCategories(selectedBrand._id)
        if (entityType === "product" && selectedSubCategoryId) fetchProducts(selectedSubCategoryId)
      } else {
        const errorData = await res.json()
        alert(`Failed to save: ${errorData.error || "Unknown server error"}`)
      }
    } catch (error) {
      console.error("Save operation failed:", error)
      alert("An error occurred. Check the console for details.")
    }
  }

  const handleDelete = async (entityType: EntityType, id: string) => {
    const apiPath = getApiPath(entityType)
    if (!apiPath) return
    if (confirm(`Are you sure you want to delete this ${entityType}?`)) {
      try {
        const res = await fetch(`/api/${apiPath}/${id}`, { method: "DELETE" })
        if (res.ok) {
          if (entityType === "brand") fetchBrands(productType)
          if (entityType === "subcategory" && selectedBrand) {
            setSelectedSubCategoryId(null)
            setProducts([])
            fetchSubCategories(selectedBrand._id)
          }
          if (entityType === "product" && selectedSubCategoryId) fetchProducts(selectedSubCategoryId)
        } else {
          const errorData = await res.json()
          alert(`Failed to delete: ${errorData.error}`)
        }
      } catch (error) {
        console.error("Delete operation failed:", error)
        alert("An error occurred. Check the console for details.")
      }
    }
  }

  console.log(products, "products in product manager");
  

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
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

          <ProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />


      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CubeIcon className="h-6 w-6 text-slate-600" />
            <h1 className="text-xl font-semibold text-slate-900">Product Management</h1>
          </div>
          <div className="flex rounded-lg bg-slate-200 p-1">
            {(["Retail", "In-House"] as ProductType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  productType === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {type} Products
              </button>
            ))}
             <button
              onClick={() => setIsImportModalOpen(true)}
              className="ml-4 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors duration-150 shadow-sm"
          >
              Import from Excel
          </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
        <CategoryColumn
          title="Brands"
          items={brands}
          selectedId={selectedBrand?._id || null}
          onSelect={(id) => {
            const brand = brands.find((b) => b._id === id)
            if (brand) handleSelectBrand(brand)
          }}
          onEdit={canUpdate ? (item) => handleOpenModal("brand", item) : undefined}
          onDelete={canDelete ? (id) => handleDelete("brand", id) : undefined}
          onAddNew={canCreate ? () => handleOpenModal("brand") : undefined}
          isLoading={isLoadingBrands}
        />

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
        />

        <div className="flex flex-col h-full bg-slate-50/30">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
            <h3 className="font-semibold text-lg text-slate-800">Products</h3>
            {canCreate && (
              <button
                onClick={() => handleOpenModal("product")}
                disabled={!selectedSubCategoryId}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors duration-150 shadow-sm"
              >
                <PlusIcon className="h-4 w-4" /> Add Product
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoadingProducts && (
              <div className="p-6 text-center">
                <div className="inline-flex items-center gap-2 text-slate-500">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                  <span className="text-sm">Loading products...</span>
                </div>
              </div>
            )}

            {!isLoadingProducts &&
              products.map((product) => (
                
                <div
                  key={product._id}
                  className="group bg-white p-4 border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-slate-900">{product.name}</h4>
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">
                          <TagIcon className="h-3 w-3" />
                          {product.sku}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-slate-600">
                        <p>
                          <span className="font-medium">{product.numberOfItems} items</span> × {product.quantityPerItem}
                          {product.unit} each
                        </p>
                        <p className="text-blue-600 font-medium">
                          Total Stock: {product.totalQuantity}
                          {product.unit}
                        </p>
                        <p className="text-xs text-slate-500">
                          Expires:{" "}
                          {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : "No expiry date"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-xl font-bold text-green-600">₹{product.price.toFixed(2)}</p>
                      <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {canUpdate && (
                          <button
                            onClick={() => handleOpenModal("product", product)}
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150"
                            title="Edit product"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete("product", product._id)}
                            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors duration-150"
                            title="Delete product"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            {!isLoadingProducts && products.length === 0 && (
              <div className="p-10 text-center bg-white rounded-lg border-2 border-dashed border-slate-200">
                <CubeIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h4 className="font-medium text-slate-700 mb-2">No Products Found</h4>
                <p className="text-sm text-slate-500">
                  {selectedSubCategoryId
                    ? "There are no products in this sub-category."
                    : "Select a sub-category to view its products."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
