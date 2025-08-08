// ServiceManager.tsx - FINAL, MULTI-TENANT VERSION

"use client"

import type React from "react"
import type { IServiceItem } from "@/models/ServiceItem"
import type { IServiceCategory } from "@/models/ServiceCategory"
import type { IServiceSubCategory } from "@/models/ServiceSubCategory"

import { useEffect, useState, useCallback } from "react"
import { useSession, getSession } from "next-auth/react" // 1. Import getSession
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { toast } from "react-toastify"

import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  SparklesIcon,
  ClockIcon,
} from "@heroicons/react/24/outline"

import CategoryColumn from "./CategoryColumn"
import ServiceFormModal from "./ServiceFormModal"
import ServiceImportModal from "./ServiceImportModal"

type EntityType = "service-category" | "service-sub-category" | "service-item"

export default function ServiceManager() {
  const { data: session } = useSession()

  const [mainCategories, setMainCategories] = useState<IServiceCategory[]>([])
  const [subCategories, setSubCategories] = useState<IServiceSubCategory[]>([])
  const [services, setServices] = useState<IServiceItem[]>([])

  const [selectedMainCategory, setSelectedMainCategory] = useState<IServiceCategory | null>(null)
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null)

  const [isLoadingMain, setIsLoadingMain] = useState(true)
  const [isLoadingSub, setIsLoadingSub] = useState(false)
  const [isLoadingServices, setIsLoadingServices] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalEntityType, setModalEntityType] = useState<EntityType | null>(null)
  const [entityToEdit, setEntityToEdit] = useState<any | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_CREATE)
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_UPDATE)
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_DELETE)

  // 2. --- TENANT-AWARE FETCH HELPER ---
  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const session = await getSession();
    if (!session?.user?.tenantId) {
      throw new Error("Your session is invalid. Please log in again.");
    }

    const headers = { ...options.headers, 'x-tenant-id': session.user.tenantId };
    if (options.body) {
      (headers as any)['Content-Type'] = 'application/json';
    }

    return fetch(url, { ...options, headers });
  }, []);

  const resetSelections = useCallback(() => {
    setSelectedMainCategory(null)
    setSelectedSubCategoryId(null)
    setSubCategories([])
    setServices([])
  }, [])

  const fetchMainCategories = useCallback(async () => {
    setIsLoadingMain(true)
    resetSelections()
    try {
      // 3. Use tenantFetch
      const res = await tenantFetch(`/api/service-categories`)
      const data = await res.json()
      setMainCategories(data.success ? data.data : [])
    } catch (error: any) {
      toast.error(error.message || "Failed to load categories.")
      setMainCategories([])
    } finally {
      setIsLoadingMain(false)
    }
  }, [resetSelections, tenantFetch])

  const fetchSubCategories = useCallback(async (mainCategoryId: string) => {
    setIsLoadingSub(true)
    setSelectedSubCategoryId(null)
    setServices([])
    try {
      // 3. Use tenantFetch
      const res = await tenantFetch(`/api/service-sub-categories?mainCategoryId=${mainCategoryId}`)
      const data = await res.json()
      setSubCategories(data.success ? data.data : [])
    } catch (error: any) {
      toast.error(error.message || "Failed to load sub-categories.")
      setSubCategories([])
    } finally {
      setIsLoadingSub(false)
    }
  }, [tenantFetch])

  const fetchServices = useCallback(async (subCategoryId: string) => {
    setIsLoadingServices(true)
    setServices([])
    try {
      // 3. Use tenantFetch
      const res = await tenantFetch(`/api/service-items?subCategoryId=${subCategoryId}`)
      const data = await res.json()
      setServices(data.success ? data.data : [])
    } catch (error: any) {
      toast.error(error.message || "Failed to load services.")
      setServices([])
    } finally {
      setIsLoadingServices(false)
    }
  }, [tenantFetch])

  useEffect(() => {
    fetchMainCategories()
  }, [fetchMainCategories])

  const handleSelectMainCategory = (category: IServiceCategory) => {
    setSelectedMainCategory(category)
    fetchSubCategories(category._id)
  }

  const handleSelectSubCategory = (subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId)
    fetchServices(subCategoryId)
  }

  const handleOpenModal = (type: EntityType, entity: any | null = null) => {
    setModalEntityType(type)
    setEntityToEdit(entity)
    setIsModalOpen(true)
  }

  const handleImportSuccess = (report: any) => {
    const successMessage = `Import complete: ${report.successfulImports} imported, ${report.failedImports} failed.`
    toast.success(successMessage, { autoClose: 10000 })

    if (report.failedImports > 0) {
      console.error("Service Import Errors:", report.errors)
      toast.error("Some services failed to import. Check console for details.", { autoClose: false })
    }
    fetchMainCategories()
  }

  const getApiPath = (entityType: EntityType) => {
    const paths: Record<EntityType, string> = {
      "service-category": "service-categories",
      "service-sub-category": "service-sub-categories",
      "service-item": "service-items",
    }
    return paths[entityType] || ""
  }

  const handleSave = useCallback(async (entityType: EntityType, data: any) => {
    const apiPath = getApiPath(entityType)
    if (!apiPath) return

    const isEditing = !!entityToEdit
    const url = isEditing ? `/api/${apiPath}/${entityToEdit._id}` : `/api/${apiPath}`
    const method = isEditing ? "PUT" : "POST"

    try {
      // 3. Use tenantFetch
      const res = await tenantFetch(url, {
        method,
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || "An unknown error occurred.")
      }
      
      toast.success(`'${data.name}' saved successfully!`)
      setIsModalOpen(false)

      if (entityType === "service-category") {
        fetchMainCategories()
      } else if (entityType === "service-sub-category" && selectedMainCategory) {
        fetchSubCategories(selectedMainCategory._id)
      } else if (entityType === "service-item" && selectedSubCategoryId) {
        fetchServices(selectedSubCategoryId)
      }
    } catch (error: any) {
      toast.error(`Save failed: ${error.message}`)
    }
  }, [entityToEdit, selectedMainCategory, selectedSubCategoryId, fetchMainCategories, fetchSubCategories, fetchServices, tenantFetch])

  const handleDelete = useCallback(async (entityType: EntityType, id: string) => {
    const apiPath = getApiPath(entityType)
    if (!apiPath) return

    const entityTypeName = entityType.replace(/-/g, " ")
    if (!window.confirm(`Are you sure you want to delete this ${entityTypeName}?`)) {
      return
    }

    try {
      // 3. Use tenantFetch
      const res = await tenantFetch(`/api/${apiPath}/${id}`, { method: "DELETE" })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || "An unknown error occurred.")
      }
      
      toast.success(`${entityTypeName} deleted successfully!`)

      if (entityType === "service-category") {
        fetchMainCategories()
      } else if (entityType === "service-sub-category" && selectedMainCategory) {
        fetchSubCategories(selectedMainCategory._id)
      } else if (entityType === "service-item" && selectedSubCategoryId) {
        fetchServices(selectedSubCategoryId)
      }
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message}`)
    }
  }, [selectedMainCategory, selectedSubCategoryId, fetchMainCategories, fetchSubCategories, fetchServices, tenantFetch])

  // The rest of the JSX rendering is identical.
  // ...
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-lg">
      <ServiceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        entityType={modalEntityType}
        entityToEdit={entityToEdit}
        context={{
          mainCategory: selectedMainCategory,
          subCategoryId: selectedSubCategoryId,
        }}
      />
      <ServiceImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess} 
      />

      <div className="border-b border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-6 w-6 text-slate-600" />
            <h1 className="text-xl font-semibold text-slate-900">Service Management</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-green-700"
            >
              Import Service
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-row">
        <CategoryColumn
          className="w-1/3"
          title="Categories"
          items={mainCategories}
          selectedId={selectedMainCategory?._id || null}
          onSelect={(id) => {
            const cat = mainCategories.find((c) => c._id === id)
            if (cat) handleSelectMainCategory(cat)
          }}
          onEdit={canUpdate ? (item) => handleOpenModal("service-category", item) : undefined}
          onDelete={canDelete ? (id) => handleDelete("service-category", id) : undefined}
          onAddNew={canCreate ? () => handleOpenModal("service-category") : undefined}
          isLoading={isLoadingMain}
        />

        <CategoryColumn
          className="w-1/3"
          title="Sub-Categories"
          items={subCategories}
          selectedId={selectedSubCategoryId}
          onSelect={handleSelectSubCategory}
          onEdit={canUpdate ? (item) => handleOpenModal("service-sub-category", item) : undefined}
          onDelete={canDelete ? (id) => handleDelete("service-sub-category", id) : undefined}
          onAddNew={canCreate ? () => handleOpenModal("service-sub-category") : undefined}
          isLoading={isLoadingSub}
          disabled={!selectedMainCategory}
          disabledText="Select a category to see its sub-categories."
        />

        <div className="flex h-full w-1/3 flex-col bg-slate-50/30">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-800">Services</h3>
            {canCreate && (
              <button
                onClick={() => handleOpenModal("service-item")}
                disabled={!selectedSubCategoryId}
                className="rounded-md p-1.5 text-slate-500 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                title="Add new Service"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-2">
            {isLoadingServices ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="inline-flex items-center gap-2 text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
                  <span className="text-sm">Loading services...</span>
                </div>
              </div>
            ) : services.length === 0 ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-8 text-center">
                  <SparklesIcon className="mb-4 h-10 w-10 text-slate-400" />
                  <h4 className="mb-2 font-semibold text-slate-700">No Services Found</h4>
                  <p className="max-w-sm text-sm text-slate-500">
                    {selectedSubCategoryId
                      ? "This sub-category has no services yet."
                      : "Select a sub-category to view services."}
                  </p>
                </div>
            ) : (
              services.map((service) => (
                <div
                  key={service._id}
                  className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="mb-1 truncate text-base font-semibold text-slate-900">
                          {service.name}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <ClockIcon className="h-4 w-4 text-slate-400" />
                            <span>{service.duration} min</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-3 flex-shrink-0 text-right">
                        <div className="text-xl font-bold text-green-600">
                          ₹{service.price?.toFixed(2) ?? '0.00'}
                        </div>
                        {service.membershipRate && (
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <SparklesIcon className="h-3 w-3 text-amber-600" />
                            <span className="text-xs font-medium text-amber-700">
                              ₹{service.membershipRate.toFixed(2) ?? '0.00'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {service.consumables && service.consumables.length > 0 && (
                    <div className="border-y border-slate-100 bg-slate-50/50 px-4 py-3">
                      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Consumables ({service.consumables.length})
                      </h5>
                      <div className="max-h-24 space-y-2 overflow-y-auto pr-2">
                        {service.consumables.map((con, index) => {
                          const quantity = con.quantity.default;
                          return (
                            <div key={index} className="flex items-center justify-between">
                              <span className="mr-2 flex-1 truncate text-xs text-slate-600">
                                {(con.product as any)?.name || "N/A"}
                              </span>
                              <span className="rounded border bg-white px-2 py-0.5 font-mono text-xs text-slate-800">
                                {quantity}
                                {con.unit}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div className="bg-white px-4 py-2">
                    <div className="flex justify-end gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      {canUpdate && (
                        <button
                          onClick={() => handleOpenModal("service-item", service)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                          title="Edit service"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete("service-item", service._id)}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                          title="Delete service"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}