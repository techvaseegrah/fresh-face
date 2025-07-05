"use client"

import type React from "react"

import type { IServiceItem } from "@/models/ServiceItem"
import type { IServiceCategory } from "@/models/ServiceCategory"
import type { IServiceSubCategory } from "@/models/ServiceSubCategory"
import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  SparklesIcon,
  UserGroupIcon,
  ClockIcon,
} from "@heroicons/react/24/outline"
import CategoryColumn from "./CategoryColumn"
import ServiceFormModal from "./ServiceFormModal"
import { toast } from "react-toastify"
import ServiceImportModal from "./ServiceImportModal"

type AudienceType = "Unisex" | "male" | "female"
type EntityType = "service-category" | "service-sub-category" | "service-item"

const ColumnSkeleton = () => (
  <div className="animate-pulse space-y-3 p-4">
    <div className="h-6 bg-slate-200 rounded-md w-3/4"></div>
    <div className="h-10 bg-slate-200 rounded-md"></div>
    <div className="h-10 bg-slate-200 rounded-md"></div>
    <div className="h-10 bg-slate-200 rounded-md"></div>
  </div>
)

export default function ServiceManager() {
  const { data: session } = useSession()

  const [audienceFilter, setAudienceFilter] = useState<AudienceType>("female")
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false); // <-- ADD NEW STATE



  const canCreate = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_CREATE)
  const canUpdate = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_UPDATE)
  const canDelete = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_DELETE)

  const resetSelections = useCallback(() => {
    setSelectedMainCategory(null)
    setSelectedSubCategoryId(null)
    setSubCategories([])
    setServices([])
  }, [])

  const handleAudienceChange = (newAudience: AudienceType) => {
    if (newAudience === audienceFilter) return
    setAudienceFilter(newAudience)
    resetSelections()
  }

  const fetchMainCategories = useCallback(async (audience: AudienceType) => {
    setIsLoadingMain(true)
    const res = await fetch(`/api/service-categories?audience=${audience}`)
    const data = await res.json()
    setMainCategories(data.success ? data.data : [])
    setIsLoadingMain(false)
  }, [])

  useEffect(() => {
    fetchMainCategories(audienceFilter)
  }, [audienceFilter, fetchMainCategories])

  const fetchSubCategories = useCallback(async (mainCategoryId: string) => {
    setIsLoadingSub(true)
    setSelectedSubCategoryId(null)
    setServices([])
    const res = await fetch(`/api/service-sub-categories?mainCategoryId=${mainCategoryId}`)
    const data = await res.json()
    setSubCategories(data.success ? data.data : [])
    setIsLoadingSub(false)
  }, [])

  const fetchServices = useCallback(async (subCategoryId: string) => {
    setIsLoadingServices(true)
    const res = await fetch(`/api/service-items?subCategoryId=${subCategoryId}`)
    const data = await res.json()
    setServices(data.success ? data.services : [])
    setIsLoadingServices(false)
  }, [])

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

  const getApiPath = (entityType: EntityType) => {
    const paths: Record<EntityType, string> = {
      "service-category": "service-categories",
      "service-sub-category": "service-sub-categories",
      "service-item": "service-items",
    }
    return paths[entityType] || ""
  }
  const handleImportSuccess = (report: any) => {
    const successMessage = `Import complete: ${report.successfulImports} imported, ${report.failedImports} failed.`;
    toast.success(successMessage, { autoClose: 10000 });
    if (report.failedImports > 0) {
      console.error("Service Import Errors:", report.errors);
      toast.error("Some services failed to import. Check the console for a detailed report.", { autoClose: false });
    }
    fetchMainCategories(audienceFilter);
  };


  const handleSave = async (entityType: EntityType, data: any) => {
    const isEditing = !!entityToEdit
    const id = isEditing ? entityToEdit._id : ""
    const apiPath = getApiPath(entityType)
    if (!apiPath) return

    const url = isEditing ? `/api/${apiPath}/${id}` : `/api/${apiPath}`
    const res = await fetch(url, {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      setIsModalOpen(false)
      if (entityType === "service-category") fetchMainCategories(audienceFilter)
      if (entityType === "service-sub-category" && selectedMainCategory) fetchSubCategories(selectedMainCategory._id)
      if (entityType === "service-item" && selectedSubCategoryId) fetchServices(selectedSubCategoryId)
    } else {
      const errorData = await res.json()
      alert(`Failed to save: ${errorData.error || "Unknown error"}`)
    }
  }

  const handleDelete = async (entityType: EntityType, id: string) => {
    const apiPath = getApiPath(entityType)
    if (!apiPath) return

    if (confirm(`Are you sure you want to delete this ${entityType.replace(/-/g, " ")}?`)) {
      const res = await fetch(`/api/${apiPath}/${id}`, { method: "DELETE" })
      if (res.ok) {
        if (entityType === "service-category") {
          resetSelections()
          fetchMainCategories(audienceFilter)
        }
        if (entityType === "service-sub-category" && selectedMainCategory) {
          setSelectedSubCategoryId(null)
          setServices([])
          fetchSubCategories(selectedMainCategory._id)
        }
        if (entityType === "service-item" && selectedSubCategoryId) fetchServices(selectedSubCategoryId)
      } else {
        const errorData = await res.json()
        alert(`Failed to delete: ${errorData.error || "Unknown error"}`)
      }
    }
  }

  return (  
    <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
      <ServiceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        entityType={modalEntityType}
        entityToEdit={entityToEdit}
        context={{
          audience: audienceFilter,
          mainCategory: selectedMainCategory,
          subCategoryId: selectedSubCategoryId,
        }}
      />

 {/* **THE FIX: Pass the current audience to the import modal** */}
      <ServiceImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        audience={audienceFilter} 
      />

      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-6 w-6 text-slate-600" />
            <h1 className="text-xl font-semibold text-slate-900">Service Management</h1>
          </div>
          <div className="flex rounded-lg bg-slate-200 p-1">
            {(
              [
                ["female", UserIcon, "Female"],
                ["male", UserIcon, "Male"],
                ["Unisex", UserGroupIcon, "Unisex"],
              ] as [AudienceType, React.ElementType, string][]
            ).map(([type, Icon, label]) => (
              <button
                key={type}
                onClick={() => handleAudienceChange(type)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  audienceFilter === type ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {canCreate && (
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm"
                >
                    Import Services
                </button>
             )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
        <div className="border-r border-slate-200 flex flex-col h-full">
          {isLoadingMain ? (
            <ColumnSkeleton />
          ) : (
            <CategoryColumn
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
          )}
        </div>

        <div className="border-r border-slate-200 flex flex-col h-full">
          {isLoadingSub ? (
            <ColumnSkeleton />
          ) : (
            <CategoryColumn
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
          )}
        </div>

        <div className="flex flex-col w-full h-full bg-slate-50/30">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
            <h3 className="font-semibold text-lg text-slate-800">Services</h3>
            {canCreate && (
              <button
                onClick={() => handleOpenModal("service-item")}
                disabled={!selectedSubCategoryId}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors duration-150 shadow-sm"
              >
                <PlusIcon className="h-4 w-4" /> Add Service
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoadingServices && (
              <div className="p-6 text-center">
                <div className="inline-flex items-center gap-2 text-slate-500">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                  <span className="text-sm">Loading services...</span>
                </div>
              </div>
            )}

            {!isLoadingServices &&
              services.map((service) => (
                <div
                  key={service._id}
                  className="group bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden"
                >
                  {/* Header Section */}
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 text-base truncate mb-1">{service.name}</h4>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <ClockIcon className="h-4 w-4 text-slate-400" />
                            <span>{service.duration} min</span>
                          </div>
                        </div>
                      </div>

                      {/* Price Section */}
                      <div className="text-right ml-3 flex-shrink-0">
                        <div className="text-xl font-bold text-green-600">₹{service.price.toFixed(2)}</div>
                        {service.membershipRate && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <SparklesIcon className="h-3 w-3 text-amber-600" />
                            <span className="text-xs text-amber-700 font-medium">
                              ₹{service.membershipRate.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Consumables Section */}
                  {service.consumables && service.consumables.length > 0 && (
                    <div className="px-4 py-3 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                          Consumables ({service.consumables.length})
                        </h5>
                      </div>
                      <div className="space-y-2 max-h-24 overflow-y-auto">
                        {service.consumables.map((con, index) => {
                          const serviceAudience = service.audience as AudienceType
                          const quantity =
                            serviceAudience === "male" && con.quantity.male !== undefined
                              ? con.quantity.male
                              : serviceAudience === "female" && con.quantity.female !== undefined
                                ? con.quantity.female
                                : con.quantity.default
                          return (
                            <div key={index} className="flex items-center justify-between py-1">
                              <span className="text-xs text-slate-600 truncate flex-1 mr-2">
                                {(con.product as any)?.name || "N/A"}
                              </span>
                              <span className="text-xs font-mono text-slate-800 bg-white px-2 py-0.5 rounded border">
                                {quantity}
                                {con.unit}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions Section */}
                  <div className="px-4 py-3 bg-white border-t border-slate-100">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {canUpdate && (
                        <button
                          onClick={() => handleOpenModal("service-item", service)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors duration-150"
                          title="Edit service"
                        >
                          <PencilIcon className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete("service-item", service._id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors duration-150"
                          title="Delete service"
                        >
                          <TrashIcon className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

            {!isLoadingServices && services.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg border-2 border-dashed border-slate-200 min-h-[200px]">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <SparklesIcon className="h-8 w-8 text-slate-400" />
                </div>
                <h4 className="font-semibold text-slate-700 mb-2">No Services Available</h4>
                <p className="text-sm text-slate-500 max-w-sm">
                  {selectedSubCategoryId
                    ? "This sub-category doesn't have any services yet. Add your first service to get started."
                    : selectedMainCategory
                      ? "Select a sub-category to view and manage its services."
                      : "Choose a category and sub-category to begin managing services."}
                </p>
                {canCreate && selectedSubCategoryId && (
                  <button
                    onClick={() => handleOpenModal("service-item")}
                    className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-150"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add First Service
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
