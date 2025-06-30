// src/components/admin/CategoryColumn.tsx
'use client';

import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

interface Item {
  _id: string;
  name: string;
}

interface Props {
  title: string;
  items: Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit?: (item: Item) => void;
  onDelete?: (id: string) => void;
  onAddNew?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  disabledText?: string;
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
  disabledText = "Select an item from the previous column first." 
}: Props) {
  return (
    <div className={`flex flex-col w-full h-full bg-white ${disabled ? 'opacity-50 bg-gray-50' : ''}`}>
      {/* Column Header */}
      <div className="p-4 border-b border-gray-200 shrink-0">
        <h3 className="font-semibold text-lg text-gray-800">{title}</h3>
      </div>

      {/* Items List */}
      <div className="flex-grow overflow-y-auto">
        {isLoading && (
          <div className="p-4 space-y-3 animate-pulse">
            <div className="h-8 rounded bg-gray-200 w-3/4"></div>
            <div className="h-8 rounded bg-gray-200 w-full"></div>
            <div className="h-8 rounded bg-gray-200 w-full"></div>
          </div>
        )}
        {!isLoading && items.map((item) => (
          <div 
            key={item._id} 
            onClick={() => !disabled && onSelect(item._id)}
            className={`flex justify-between items-center group w-full text-left text-sm pr-2 transition-colors duration-150 ${!disabled ? 'cursor-pointer' : 'cursor-default'} ${selectedId === item._id ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}`}
          >
            <span className="px-4 py-3 block truncate font-medium">{item.name}</span>
            <div className={`flex items-center shrink-0 gap-1 ${selectedId === item._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className={`p-1.5 rounded ${selectedId === item._id ? 'hover:bg-indigo-700' : 'hover:bg-gray-200'}`}><PencilIcon className="h-4 w-4" /></button>}
              {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(item._id); }} className={`p-1.5 rounded ${selectedId === item._id ? 'hover:bg-indigo-700' : 'hover:bg-red-100 text-red-500'}`}><TrashIcon className="h-4 w-4" /></button>}
            </div>
          </div>
        ))}
        {!isLoading && items.length === 0 && (
          <div className="p-4 text-sm text-center text-gray-400 mt-4">
            {disabled ? disabledText : `No ${title.toLowerCase()} found.`}
          </div>
        )}
      </div>

      {/* Add New Button Footer */}
      {onAddNew && (
        <div className="p-2 border-t border-gray-200 shrink-0">
          <button 
            onClick={onAddNew} 
            disabled={disabled} 
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <PlusIcon className="h-5 w-5" /> Add New {title.endsWith('s') ? title.slice(0, -1) : title}
          </button>
        </div>
      )}
    </div>
  );
}