"use client"

import type React from "react"

import { useState, useEffect, type FormEvent, type FC, type PropsWithChildren } from "react"
import { useSession } from "next-auth/react"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { Mail, Bell, AtSign, X, Plus } from "lucide-react"

// Toast notification component
const Toast: FC<{ message: string; show: boolean; isError: boolean }> = ({ message, show, isError }) => {
  if (!show) return null
  return (
    <div
      className={`fixed top-4 right-4 px-4 py-3 rounded-lg text-white shadow-lg transition-all duration-300 z-50 ${
        isError ? "bg-red-500" : "bg-emerald-500"
      } ${show ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  )
}

// Enhanced settings card component
const SettingsCard: FC<
  PropsWithChildren<{
    title: string
    description: string
    icon: React.ReactNode
    formProps: any
  }>
> = ({ title, description, icon, formProps, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">{icon}</div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <form {...formProps}>{children}</form>
    </div>
  </div>
)

// Email tag component
const EmailTag: FC<{ email: string; onRemove?: () => void; canRemove: boolean }> = ({ email, onRemove, canRemove }) => (
  <div className="inline-flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
    <span className="text-sm text-gray-700">{email}</span>
    {canRemove && onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 hover:bg-red-100 rounded-full transition-colors duration-150 group"
      >
        <X className="h-3.5 w-3.5 text-gray-400 group-hover:text-red-500" />
      </button>
    )}
  </div>
)

// Loading skeleton
const LoadingSkeleton = () => (
  <div className="p-6 bg-gray-50">
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="h-8 bg-gray-200 rounded w-48 mb-3 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-80 animate-pulse"></div>
      </div>
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded w-40 mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

export default function AlertsPage() {
  const { data: session } = useSession()
  const userPermissions = session?.user?.role?.permissions || []

  const canReadAlerts = hasPermission(userPermissions, PERMISSIONS.ALERTS_READ)
  const canCreateAlerts = hasPermission(userPermissions, PERMISSIONS.ALERTS_CREATE)
  const canDeleteAlerts = hasPermission(userPermissions, PERMISSIONS.ALERTS_DELETE)

  // All your existing state and logic remains unchanged
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState({ message: "", show: false, isError: false })
  const [dayEndRecipients, setDayEndRecipients] = useState<string[]>([])
  const [newDayEndRecipient, setNewDayEndRecipient] = useState("")
  const [isDayEndSaving, setIsDayEndSaving] = useState(false)
  const [lowStockThreshold, setLowStockThreshold] = useState("")
  const [lowStockRecipients, setLowStockRecipients] = useState<string[]>([])
  const [newLowStockRecipient, setNewLowStockRecipient] = useState("")
  const [isLowStockSaving, setIsLowStockSaving] = useState(false)

  // All your existing useEffect and functions remain unchanged
  useEffect(() => {
    if (canReadAlerts) {
      const fetchAllSettings = async () => {
        setIsLoading(true)
        try {
          const [dayEndRes, thresholdRes, lowStockRecipientsRes] = await Promise.all([
            fetch("/api/settings/dayEndReportRecipients"),
            fetch("/api/settings/globalLowStockThreshold"),
            fetch("/api/settings/inventoryAlertRecipients"),
          ])
          const dayEndData = await dayEndRes.json()
          const thresholdData = await thresholdRes.json()
          const lowStockRecipientsData = await lowStockRecipientsRes.json()
          if (dayEndData.success) setDayEndRecipients(dayEndData.setting.value || [])
          if (thresholdData.success) setLowStockThreshold(thresholdData.setting.value || "10")
          if (lowStockRecipientsData.success) setLowStockRecipients(lowStockRecipientsData.setting.value || [])
        } catch (error) {
          console.error("Error fetching settings:", error)
          showToast("Failed to load settings from server.", true)
        } finally {
          setIsLoading(false)
        }
      }
      fetchAllSettings()
    } else {
      setIsLoading(false)
    }
  }, [canReadAlerts])

  const showToast = (message: string, isError = false) => {
    setToast({ message, show: true, isError })
    setTimeout(() => setToast({ message: "", show: false, isError: false }), 4000)
  }

  const handleAddDayEndEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(newDayEndRecipient)) {
      showToast("Please enter a valid email address.", true)
      return
    }
    if (dayEndRecipients.includes(newDayEndRecipient)) {
      showToast("This email is already added.", true)
      return
    }
    setDayEndRecipients([...dayEndRecipients, newDayEndRecipient])
    setNewDayEndRecipient("")
    showToast("Email added successfully!")
  }

  const handleRemoveDayEndEmail = (email: string) => {
    setDayEndRecipients(dayEndRecipients.filter((e) => e !== email))
    showToast("Email removed successfully!")
  }

  const handleSaveDayEndSettings = async (e: FormEvent) => {
    e.preventDefault()
    setIsDayEndSaving(true)
    try {
      const res = await fetch("/api/settings/dayEndReportRecipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: dayEndRecipients }),
      })
      const data = await res.json()
      data.success
        ? showToast("Day-end report settings saved successfully!")
        : showToast(data.message || "An error occurred", true)
    } catch (error) {
      showToast("An error occurred while saving.", true)
    } finally {
      setIsDayEndSaving(false)
    }
  }

  const handleAddLowStockEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(newLowStockRecipient)) {
      showToast("Please enter a valid email address.", true)
      return
    }
    if (lowStockRecipients.includes(newLowStockRecipient)) {
      showToast("This email is already added.", true)
      return
    }
    setLowStockRecipients([...lowStockRecipients, newLowStockRecipient])
    setNewLowStockRecipient("")
    showToast("Email added successfully!")
  }

  const handleRemoveLowStockEmail = (email: string) => {
    setLowStockRecipients(lowStockRecipients.filter((e) => e !== email))
    showToast("Email removed successfully!")
  }

  const handleSaveLowStockSettings = async (e: FormEvent) => {
    e.preventDefault()
    setIsLowStockSaving(true)
    try {
      const [thresholdRes, recipientsRes] = await Promise.all([
        fetch("/api/settings/globalLowStockThreshold", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: lowStockThreshold }),
        }),
        fetch("/api/settings/inventoryAlertRecipients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: lowStockRecipients }),
        }),
      ])
      thresholdRes.ok && recipientsRes.ok
        ? showToast("Low stock alert settings saved successfully!")
        : showToast("Failed to save one or more settings.", true)
    } catch (error) {
      showToast("An error occurred while saving.", true)
    } finally {
      setIsLowStockSaving(false)
    }
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (!canReadAlerts) {
    return (
      <div className="p-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-red-100 p-8 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="h-6 w-6 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view alert settings.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Alert Management</h1>
            <p className="text-gray-600">Configure notification settings and manage who receives important alerts.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Day-End Summary Report Card */}
            <SettingsCard
              title="Day-End Summary Report"
              description="Send daily business summaries to key stakeholders."
              icon={<Mail className="h-5 w-5 text-blue-600" />}
              formProps={{ onSubmit: handleSaveDayEndSettings }}
            >
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">Email Recipients</label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        value={newDayEndRecipient}
                        onChange={(e) => setNewDayEndRecipient(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1877F2] focus:border-transparent text-sm bg-white transition-all duration-200"
                        disabled={!canCreateAlerts}
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddDayEndEmail())}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDayEndEmail}
                      disabled={!canCreateAlerts || !newDayEndRecipient.trim()}
                      className="px-4 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-gray-300 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Recipients List */}
                <div>
                  {dayEndRecipients.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {dayEndRecipients.map((email) => (
                        <EmailTag
                          key={email}
                          email={email}
                          onRemove={() => handleRemoveDayEndEmail(email)}
                          canRemove={canDeleteAlerts}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                      <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No recipients added yet</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={isDayEndSaving || !canCreateAlerts}
                    className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-gray-400 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2"
                  >
                    {isDayEndSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </div>
            </SettingsCard>

            {/* Low Stock Alerts Card */}
            <SettingsCard
              title="Low Stock Alerts"
              description="Get notified when inventory levels drop below threshold."
              icon={<Bell className="h-5 w-5 text-blue-600" />}
              formProps={{ onSubmit: handleSaveLowStockSettings }}
            >
              <div className="space-y-5">
                <div>
                  <label htmlFor="threshold" className="block text-sm font-medium text-gray-900 mb-3">
                    Global Low Stock Threshold
                  </label>
                  <div className="max-w-xs">
                    <input
                      id="threshold"
                      type="number"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      placeholder="10"
                      min="1"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1877F2] focus:border-transparent text-sm bg-white transition-all duration-200"
                      required
                      disabled={!canCreateAlerts}
                    />
                    <p className="text-xs text-gray-500 mt-2">Items below this number will trigger alerts</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">Alert Recipients</label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        value={newLowStockRecipient}
                        onChange={(e) => setNewLowStockRecipient(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1877F2] focus:border-transparent text-sm bg-white transition-all duration-200"
                        disabled={!canCreateAlerts}
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddLowStockEmail())}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLowStockEmail}
                      disabled={!canCreateAlerts || !newLowStockRecipient.trim()}
                      className="px-4 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-gray-300 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Recipients List */}
                <div>
                  {lowStockRecipients.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {lowStockRecipients.map((email) => (
                        <EmailTag
                          key={email}
                          email={email}
                          onRemove={() => handleRemoveLowStockEmail(email)}
                          canRemove={canDeleteAlerts}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                      <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No recipients added yet</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={isLowStockSaving || !canCreateAlerts}
                    className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-gray-400 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2"
                  >
                    {isLowStockSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </div>
            </SettingsCard>
          </div>
        </div>
      </div>

      <Toast message={toast.message} show={toast.show} isError={toast.isError} />
    </>
  )
}