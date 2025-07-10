"use client"

import { useState, useEffect, FormEvent } from "react"
import { XMarkIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"

interface ReportDownloadModalProps {
  isOpen: boolean
  onClose: () => void
  onDownload: (params: { startDate: Date; endDate: Date; format: "pdf" | "excel" }) => void
  isDownloading: boolean
}

export default function ReportDownloadModal({
  isOpen,
  onClose,
  onDownload,
  isDownloading,
}: ReportDownloadModalProps) {
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [format, setFormat] = useState<"pdf" | "excel">("excel")
  const [error, setError] = useState("")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (endDate < startDate) {
      setError("End date cannot be before start date.")
      return
    }
    setError("")
    onDownload({ startDate, endDate, format })
  }

  useEffect(() => {
    if (isOpen) {
      const today = new Date()
      setStartDate(today)
      setEndDate(today)
      setError("")
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <style jsx global>{`
        .react-datepicker-popper.react-datepicker-high-z {
          z-index: 60 !important;
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl overflow-visible">
          <div className="flex items-center justify-between p-5 border-b bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-800">Download Excel Report</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 rounded-full hover:bg-gray-200 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date Range</label>
                <div className="flex items-center gap-2">
                  <div className="relative w-full">
                    <DatePicker
                      selected={startDate}
                      onChange={(date: Date | null) => date && setStartDate(date)}
                      selectsStart
                      startDate={startDate}
                      endDate={endDate}
                      maxDate={new Date()}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      dateFormat="dd/MM/yyyy"
                      popperClassName="react-datepicker-high-z"
                      popperPlacement="bottom-start"
                      portalId="root-portal"
                    />
                  </div>
                  <span className="text-gray-500">to</span>
                  <div className="relative w-full">
                    <DatePicker
                      selected={endDate}
                      onChange={(date: Date | null) => date && setEndDate(date)}
                      selectsEnd
                      startDate={startDate}
                      endDate={endDate}
                      
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      dateFormat="dd/MM/yyyy"
                      popperClassName="react-datepicker-high-z"
                      popperPlacement="bottom-start"
                      portalId="root-portal"
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              </div>

              {/* Format selection (still hidden for now) */}
              <div className="hidden">
                <label className="flex items-center">
                  <input type="radio" name="format" value="excel" checked readOnly />
                  <span className="ml-2">Excel (XLSX)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end p-5 bg-gray-50 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={isDownloading}
                className="px-4 py-2 mr-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!startDate || !endDate || isDownloading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                {isDownloading ? "Generating..." : "Generate & Download"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
