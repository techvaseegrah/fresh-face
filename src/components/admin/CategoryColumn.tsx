"use client"

import { PencilIcon, TrashIcon, PlusIcon, FolderOpenIcon, ArrowLeftIcon } from "@heroicons/react/24/outline"

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
  onBack?: () => void
  isLoading: boolean
  disabled?: boolean
  disabledText?: string
  className?: string
}

export default function CategoryColumn({
  title,
  items,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAddNew,
  onBack,
  isLoading,
  disabled = false,
  disabledText = "Select an item in the previous column.",
  className = "",
}: Props) {
  return (
    <div
      className={`flex h-full flex-col bg-slate-50/50 sm:border-r sm:border-slate-200 ${className}`}
    >
      {/* Header (No Changes Here) */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-md p-1.5 hover:bg-slate-100 sm:hidden"
              title="Go back"
            >
              <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
            </button>
          )}
          <h3 className="text-base font-semibold tracking-tight text-slate-800 sm:text-lg">{title}</h3>
        </div>
        
        {onAddNew && (
          <button
            onClick={onAddNew}
            disabled={disabled}
            className="rounded-md p-1.5 text-slate-500 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            title={`Add new ${title.slice(0, -1)}`}
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="inline-flex items-center gap-2 text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        ) : disabled ? (
          // --- FIX 1: Explicitly render rich placeholder for DISABLED state ---
          <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-500">
            <FolderOpenIcon className="mb-2 h-10 w-10 text-slate-400" />
            <p className="text-sm">{disabledText}</p>
          </div>
        ) : items.length === 0 ? (
          // Render rich placeholder for EMPTY state
          <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-500">
            <FolderOpenIcon className="mb-2 h-10 w-10 text-slate-400" />
            <p className="font-medium">No {title.toLowerCase()}</p>
            <p className="text-xs">Click the '+' button above to add one.</p>
          </div>
        ) : (
          // Render the list of items
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item._id}
                onClick={() => onSelect(item._id)}
                className={`group flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors duration-150 ${
                  selectedId === item._id
                    ? "bg-blue-100 font-semibold text-blue-900"
                    : "text-slate-700 hover:bg-slate-200/70"
                }`}
              >
                <span className="truncate pr-2">{item.name}</span>
                <div className="flex flex-shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  {onEdit && (
                    <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="rounded-md p-1.5 hover:bg-slate-300/50" title={`Edit ${item.name}`}>
                      <PencilIcon className="h-4 w-4 text-slate-600" />
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(item._id); }} className="rounded-md p-1.5 hover:bg-red-100" title={`Delete ${item.name}`}>
                      <TrashIcon className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}