"use client"

import { useState, useEffect, type FormEvent } from "react"
import { Mail, Bell, Plus, X, AtSign, AlertTriangle } from "lucide-react"

// Custom Toast Component
const Toast = ({ message, show, isError }: { message: string; show: boolean; isError: boolean }) => {
  if (!show) return null
  return (
    <div
      className={`fixed bottom-5 right-5 px-6 py-3 rounded-lg text-white shadow-lg transition-all duration-300 z-50 ${
        isError ? "bg-red-600" : "bg-green-600"
      }`}
    >
      {message}
    </div>
  )
}

export default function AlertsPage() {
  // All your existing state management (preserved exactly)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState({ message: "", show: false, isError: false })
  const [dayEndRecipients, setDayEndRecipients] = useState<string[]>([])
  const [newDayEndRecipient, setNewDayEndRecipient] = useState("")
  const [isDayEndSaving, setIsDayEndSaving] = useState(false)
  const [lowStockThreshold, setLowStockThreshold] = useState("")
  const [lowStockRecipients, setLowStockRecipients] = useState<string[]>([])
  const [newLowStockRecipient, setNewLowStockRecipient] = useState("")
  const [isLowStockSaving, setIsLowStockSaving] = useState(false)

  // All your existing useEffect and functions (preserved exactly)
  useEffect(() => {
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
  }, [])

  const showToast = (message: string, isError = false) => {
    setToast({ message, show: true, isError })
    setTimeout(() => setToast({ message: "", show: false, isError: false }), 3000)
  }

  const handleAddDayEndEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(newDayEndRecipient)) {
      showToast("Please enter a valid email.", true)
      return
    }
    if (dayEndRecipients.includes(newDayEndRecipient)) {
      showToast("This email is already added.", true)
      return
    }
    setDayEndRecipients([...dayEndRecipients, newDayEndRecipient])
    setNewDayEndRecipient("")
  }

  const handleRemoveDayEndEmail = (email: string) => setDayEndRecipients(dayEndRecipients.filter((e) => e !== email))

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
      data.success ? showToast("Day-End settings saved!") : showToast(data.message || "An error occurred", true)
    } catch (error) {
      showToast("An error occurred while saving.", true)
    } finally {
      setIsDayEndSaving(false)
    }
  }

  const handleAddLowStockEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(newLowStockRecipient)) {
      showToast("Please enter a valid email.", true)
      return
    }
    if (lowStockRecipients.includes(newLowStockRecipient)) {
      showToast("This email is already added.", true)
      return
    }
    setLowStockRecipients([...lowStockRecipients, newLowStockRecipient])
    setNewLowStockRecipient("")
  }

  const handleRemoveLowStockEmail = (email: string) =>
    setLowStockRecipients(lowStockRecipients.filter((e) => e !== email))

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
        ? showToast("Low stock settings saved successfully!")
        : showToast("Failed to save one or more low stock settings.", true)
    } catch (error) {
      showToast("An error occurred while saving.", true)
    } finally {
      setIsLowStockSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
            <span className="text-gray-600">Loading alert settings...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Alert Management</h1>
            <p className="text-muted-foreground mt-1">Configure notification settings for important business events</p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Day-End Summary Report Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Day-End Summary Report</h2>
                <p className="text-sm text-gray-600 mt-1">Configure email recipients for daily closing reports</p>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-6">
            <form onSubmit={handleSaveDayEndSettings} className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="dayend-email" className="block text-sm font-medium text-gray-700">
                  Add Recipients
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="dayend-email"
                      type="email"
                      placeholder="Enter email address"
                      value={newDayEndRecipient}
                      onChange={(e) => setNewDayEndRecipient(e.target.value)}
                      className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDayEndEmail}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200"></div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Current Recipients</label>
                {dayEndRecipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {dayEndRecipients.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-x-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 border border-gray-200"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveDayEndEmail(email)}
                          className="h-4 w-4 p-0 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recipients configured yet</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isDayEndSaving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDayEndSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Low Stock Alerts Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Low Stock Alerts</h2>
                <p className="text-sm text-gray-600 mt-1">Set inventory thresholds and notification recipients</p>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-6">
            <form onSubmit={handleSaveLowStockSettings} className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label htmlFor="threshold" className="block text-sm font-medium text-gray-700">
                    Global Low Stock Threshold
                  </label>
                  <input
                    id="threshold"
                    type="number"
                    placeholder="10"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    required
                    min="1"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500">Alert when inventory falls below this number</p>
                </div>

                <div className="space-y-3">
                  <label htmlFor="lowstock-email" className="block text-sm font-medium text-gray-700">
                    Add Alert Recipients
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="lowstock-email"
                        type="email"
                        placeholder="Enter email address"
                        value={newLowStockRecipient}
                        onChange={(e) => setNewLowStockRecipient(e.target.value)}
                        className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLowStockEmail}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200"></div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Alert Recipients</label>
                {lowStockRecipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {lowStockRecipients.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-x-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 border border-gray-200"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveLowStockEmail(email)}
                          className="h-4 w-4 p-0 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No alert recipients configured yet</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isLowStockSaving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLowStockSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <Toast message={toast.message} show={toast.show} isError={toast.isError} />
    </div>
  )
}