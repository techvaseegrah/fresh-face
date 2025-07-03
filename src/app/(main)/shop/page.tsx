"use client"

import { useState } from "react"
import ServiceManager from "@/components/admin/ServiceManager"
import StylistManager from "@/components/admin/StylistManager"
import ProductManager from "@/components/admin/ProductManager"
import { useSession } from "next-auth/react"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

type ShopTab = "products" | "services" | "stylists"

export default function StoreManagementPage() {
  const { data: session } = useSession()

  const canReadProducts = session && hasPermission(session.user.role.permissions, PERMISSIONS.PRODUCTS_READ)
  const canReadServices = session && hasPermission(session.user.role.permissions, PERMISSIONS.SERVICES_READ)
  const canReadStylists = session && hasPermission(session.user.role.permissions, PERMISSIONS.STYLISTS_READ)

  const availableTabs: { id: ShopTab; label: string; show: boolean }[] = [
    { id: "products", label: "Products", show: canReadProducts ?? false },
    { id: "services", label: "Services", show: canReadServices ?? false },
    { id: "stylists", label: "Stylists", show: canReadStylists ?? false },
  ]

  const visibleTabs = availableTabs.filter((tab) => tab.show)

  const [activeTab, setActiveTab] = useState<ShopTab | null>(visibleTabs.length > 0 ? visibleTabs[0].id : null)

  const renderContent = () => {
    switch (activeTab) {
      case "products":
        return canReadProducts ? <ProductManager /> : null
      case "services":
        return canReadServices ? <ServiceManager /> : null
      case "stylists":
        return canReadStylists ? <StylistManager /> : null
      default:
        return (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-700">Access Denied</h2>
              <p className="text-gray-500 mt-1 text-sm">
                You do not have permission to view any shop management modules.
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Shop Management</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your shop components</p>
          </div>

          {/* Compact Tab Navigation */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area - Full Height */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  )
}
