// components/ReportDownloadModal.tsx
"use client"

import { useState } from "react"
import { XMarkIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"

// This interface defines the props the modal expects to receive
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
  // Internal state for the form fields
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [format, setFormat] = useState<"pdf" | "excel">("pdf")

  // This function is called when the form is submitted
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
     console.log("1. MODAL is sending these params:", { startDate, endDate, format });
    // It calls the onDownload function passed from the parent,
    // sending it an object with the current state values.
    onDownload({ startDate, endDate, format })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Download Report</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 rounded-full hover:bg-gray-200 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Date Range Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Date Range</label>
              <div className="flex items-center gap-2">
                <DatePicker
                  selected={startDate}
                  onChange={(date: Date | null) => {
                    if (date) setStartDate(date)
                  }}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  dateFormat="dd/MM/yyyy"
                />
                <span className="text-gray-500">to</span>
                <DatePicker
                  selected={endDate}
                  onChange={(date: Date | null) => {
                    if (date) setEndDate(date)
                  }}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  dateFormat="dd/MM/yyyy"
                />
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Format</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value="pdf"
                    checked={format === "pdf"}
                    onChange={() => setFormat("pdf")}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-gray-700">PDF</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value="excel"
                    checked={format === "excel"}
                    onChange={() => setFormat("excel")}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-gray-700">Excel (XLSX)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end p-5 bg-gray-50 border-t rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 mr-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              {isDownloading ? "Generating..." : "Generate & Download"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}