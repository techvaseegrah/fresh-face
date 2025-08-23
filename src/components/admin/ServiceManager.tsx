"use client"

import type React from "react"
import type { IServiceItem } from "@/models/ServiceItem"
import type { IServiceCategory } from "@/models/ServiceCategory"
import type { IServiceSubCategory } from "@/models/ServiceSubCategory"

import { useEffect, useState, useCallback } from "react"
import { useSession, getSession } from "next-auth/react"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { toast } from "react-toastify"

import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  SparklesIcon,
  ClockIcon,
  ArrowLeftIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline"

import CategoryColumn from "./CategoryColumn"
import ServiceFormModal from "./ServiceFormModal"
import ServiceImportModal from "./ServiceImportModal"

type EntityType = "service-category" | "service-sub-category" | "service-item"
type MobileView = "categories" | "subcategories" | "services"

export default function ServiceManager() {
  const { data: session } = useSession()

  // --- All state and logic (no changes here) ---
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
  const [activeMobileView, setActiveMobileView] = useState<MobileView>("categories")
  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_CREATE)
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_UPDATE)
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_DELETE)

  const tenantFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const session = await getSession();
    if (!session?.user?.tenantId) { throw new Error("Your session is invalid. Please log in again."); }
    const headers = { ...options.headers, 'x-tenant-id': session.user.tenantId };
    if (options.body) { (headers as any)['Content-Type'] = 'application/json'; }
    return fetch(url, { ...options, headers });
  }, []);

  const resetSelections = useCallback(() => {
    setSelectedMainCategory(null)
    setSelectedSubCategoryId(null)
    setSubCategories([])
    setServices([])
    setActiveMobileView("categories")
  }, [])

  const fetchMainCategories = useCallback(async () => {
    setIsLoadingMain(true)
    resetSelections()
    try {
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

  useEffect(() => { fetchMainCategories() }, [fetchMainCategories])

  const handleSelectMainCategory = (category: IServiceCategory) => {
    setSelectedMainCategory(category)
    setActiveMobileView("subcategories")
    fetchSubCategories(category._id)
  }

  const handleSelectSubCategory = (subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId)
    setActiveMobileView("services")
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

  const getApiPath = (entityType: EntityType) => ({
    "service-category": "service-categories", "service-sub-category": "service-sub-categories", "service-item": "service-items",
  })[entityType] || ""

  const handleSave = useCallback(async (entityType: EntityType, data: any) => {
    const apiPath = getApiPath(entityType);
    if (!apiPath) return;
    const isEditing = !!entityToEdit;
    const url = isEditing ? `/api/${apiPath}/${entityToEdit._id}` : `/api/${apiPath}`;
    const method = isEditing ? "PUT" : "POST";
    try {
      const res = await tenantFetch(url, { method, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "An unknown error occurred.");
      toast.success(`'${data.name}' saved successfully!`);
      setIsModalOpen(false);
      if (entityType === "service-category") fetchMainCategories();
      else if (entityType === "service-sub-category" && selectedMainCategory) fetchSubCategories(selectedMainCategory._id);
      else if (entityType === "service-item" && selectedSubCategoryId) fetchServices(selectedSubCategoryId);
    } catch (error: any) { toast.error(`Save failed: ${error.message}`); }
  }, [entityToEdit, selectedMainCategory, selectedSubCategoryId, fetchMainCategories, fetchSubCategories, fetchServices, tenantFetch]);

  const handleDelete = useCallback(async (entityType: EntityType, id: string) => {
    const apiPath = getApiPath(entityType);
    if (!apiPath) return;
    const entityTypeName = entityType.replace(/-/g, " ");
    if (!window.confirm(`Are you sure you want to delete this ${entityTypeName}?`)) return;
    try {
      const res = await tenantFetch(`/api/${apiPath}/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "An unknown error occurred.");
      toast.success(`${entityTypeName} deleted successfully!`);
      if (entityType === "service-category") fetchMainCategories();
      else if (entityType === "service-sub-category" && selectedMainCategory) fetchSubCategories(selectedMainCategory._id);
      else if (entityType === "service-item" && selectedSubCategoryId) fetchServices(selectedSubCategoryId);
    } catch (error: any) { toast.error(`Delete failed: ${error.message}`); }
  }, [selectedMainCategory, selectedSubCategoryId, fetchMainCategories, fetchSubCategories, fetchServices, tenantFetch]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
      <ServiceFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} entityType={modalEntityType} entityToEdit={entityToEdit} context={{ mainCategory: selectedMainCategory, subCategoryId: selectedSubCategoryId }} />
      <ServiceImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImportSuccess={handleImportSuccess} />

      <div className="flex-shrink-0 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-5 w-5 text-slate-500" />
            <h1 className="text-lg font-semibold text-slate-800">Service Management</h1>
          </div>
          <button onClick={() => setIsImportModalOpen(true)} className="flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-green-700">
            Import Service
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Categories Column */}
        <div className={`flex w-full flex-col lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 ${activeMobileView === 'categories' ? 'block' : 'hidden'} lg:!flex`}>
          <CategoryColumn title="Categories" items={mainCategories} selectedId={selectedMainCategory?._id || null} onSelect={(id) => { const cat = mainCategories.find((c) => c._id === id); if (cat) handleSelectMainCategory(cat) }} onEdit={canUpdate ? (item) => handleOpenModal("service-category", item) : undefined} onDelete={canDelete ? (id) => handleDelete("service-category", id) : undefined} onAddNew={canCreate ? () => handleOpenModal("service-category") : undefined} isLoading={isLoadingMain} />
        </div>

        {/* Sub-Categories Column */}
        <div className={`flex w-full flex-col lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 ${activeMobileView === 'subcategories' ? 'block' : 'hidden'} lg:!flex`}>
          <CategoryColumn title="Sub-Categories" items={subCategories} selectedId={selectedSubCategoryId} onSelect={handleSelectSubCategory} onEdit={canUpdate ? (item) => handleOpenModal("service-sub-category", item) : undefined} onDelete={canDelete ? (id) => handleDelete("service-sub-category", id) : undefined} onAddNew={canCreate ? () => handleOpenModal("service-sub-category") : undefined} isLoading={isLoadingSub} disabled={!selectedMainCategory} disabledText="Select a category to see its sub-categories." onBack={() => setActiveMobileView("categories")} />
        </div>

        {/* Services Column */}
        <div className={`flex h-full w-full flex-col bg-slate-50 lg:w-1/3 ${activeMobileView === 'services' ? 'block' : 'hidden'} lg:!flex`}>
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2"><button onClick={() => setActiveMobileView("subcategories")} className="lg:hidden rounded-md p-1.5 hover:bg-slate-100"><ArrowLeftIcon className="h-5 w-5 text-slate-600" /></button><h3 className="font-semibold text-slate-700">Services</h3></div>
            {canCreate && (<button onClick={() => handleOpenModal("service-item")} disabled={!selectedSubCategoryId} className="rounded-md p-1.5 text-slate-400 transition-all hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30" title="Add new Service"><PlusIcon className="h-5 w-5" /></button>)}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingServices ? (
              <div className="flex h-full items-center justify-center"><div className="inline-flex items-center gap-2 text-slate-500"><div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div><span className="text-sm">Loading services...</span></div></div>
            ) : services.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400">
                <SparklesIcon className="mb-2 h-10 w-10" />
                <p className="text-sm font-medium text-slate-500">No Services Found</p>
                <p className="text-xs">
                  {selectedSubCategoryId ? "Click the '+' button to add one." : "Select a sub-category to view services."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((service) => (
                  // --- STYLING CHANGE: This block now renders the card with the consumables list, matching the screenshot ---
                  <div key={service._id} className="group relative rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
                    {/* Top part: Service Details */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-slate-800">{service.name}</h4>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                          <ClockIcon className="h-4 w-4 text-slate-400" />
                          <span>{service.duration} min</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">₹{service.price?.toFixed(2) ?? '0.00'}</p>
                        {service.membershipRate && (
                          <div className="mt-1 flex items-center justify-end gap-1.5">
                            <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs font-medium text-amber-600">₹{service.membershipRate.toFixed(2) ?? '0.00'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom part: Consumables (conditional) */}
                    {service.consumables && service.consumables.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Consumables ({service.consumables.length})
                        </h5>
                        <div className="space-y-1.5">
                          {service.consumables.map((con, index) => (
                            <div key={index} className="flex items-center justify-between text-xs">
                              <span className="flex-1 truncate pr-2 text-slate-600">
                                {(con.product as any)?.name || "N/A"}
                              </span>
                              <span className="flex-shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-700">
                                {con.quantity.default}{con.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hover Actions */}
                    <div className="absolute inset-y-0 right-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {canUpdate && (
                        <button onClick={() => handleOpenModal("service-item", service)} className="rounded-md bg-white p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100" title="Edit service">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete("service-item", service._id)} className="rounded-md bg-white p-1.5 text-red-500 shadow-sm ring-1 ring-slate-200 hover:bg-red-50" title="Delete service">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
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