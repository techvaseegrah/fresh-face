"use client"

import { PencilIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/outline"

interface Item {
  _id: string
  name: string
}

interface Props {
  title: string
  items: Item[]
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit?: (item: Item) => void
  onDelete?: (id: string) => void
  onAddNew?: () => void
  isLoading: boolean
  disabled?: boolean
  disabledText?: string
}

export default function CategoryColumn({
  title,
  items,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAddNew,
  isLoading,
  disabled = false,
  disabledText,
}: Props) {
  return (
    <div
      className={`flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-200 ${
        disabled ? "opacity-60 bg-slate-50" : ""
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h3 className="font-semibold text-lg text-slate-800 tracking-tight">{title}</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-6 text-center">
            <div className="inline-flex items-center gap-2 text-slate-500">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="p-6 text-center">
            <div className="text-slate-400 text-sm">
              {disabled && disabledText ? disabledText : `No ${title.toLowerCase()} found.`}
            </div>
          </div>
        )}

        {!isLoading &&
          items.map((item) => (
            <div
              key={item._id}
              onClick={() => !disabled && onSelect(item._id)}
              className={`group flex items-center justify-between px-4 py-3 border-b border-slate-100 transition-all duration-150 ${
                !disabled ? "cursor-pointer hover:bg-slate-50" : "cursor-default"
              } ${
                selectedId === item._id
                  ? "bg-blue-50 border-l-4 border-l-blue-500 text-blue-900"
                  : "hover:border-l-4 hover:border-l-transparent"
              }`}
            >
              <span className="flex-1 text-sm font-medium truncate pr-2">{item.name}</span>

              <div
                className={`flex items-center gap-1 transition-opacity duration-150 ${
                  selectedId === item._id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(item)
                    }}
                    className={`p-1.5 rounded-md transition-colors duration-150 ${
                      selectedId === item._id ? "hover:bg-blue-100 text-blue-700" : "hover:bg-slate-200 text-slate-600"
                    }`}
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                )}

                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item._id)
                    }}
                    className={`p-1.5 rounded-md transition-colors duration-150 ${
                      selectedId === item._id ? "hover:bg-red-100 text-red-600" : "hover:bg-red-50 text-red-500"
                    }`}
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Footer */}
      {onAddNew && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/30">
          <button
            onClick={onAddNew}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-150 shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Add {title.endsWith("s") ? title.slice(0, -1) : title}
          </button>
        </div>
      )}
    </div>
  )
}
