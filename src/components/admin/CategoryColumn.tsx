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
  onEdit?: (item: Item) => void; // Optional
  onDelete?: (id: string) => void; // Optional
  onAddNew?: () => void; // Optional
  isLoading: boolean;
  disabled?: boolean;
}

export default function CategoryColumn({ title, items, selectedId, onSelect, onEdit, onDelete, onAddNew, isLoading, disabled = false }: Props) {
  return (
    <div className={`flex flex-col w-full md:w-1/3 border-r border-gray-200 bg-white ${disabled ? 'opacity-50 bg-gray-50' : ''}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-lg text-gray-800">{title}</h3>
      </div>
      <div className="flex-grow overflow-y-auto">
        {isLoading && <div className="p-4 text-gray-500">Loading...</div>}
        {!isLoading && items.map((item) => (
          <div key={item._id} onClick={() => !disabled && onSelect(item._id)}
            className={`flex justify-between items-center group w-full text-left text-sm pr-2 ${!disabled ? 'cursor-pointer' : 'cursor-default'} ${selectedId === item._id ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
          >
            <span className="px-4 py-3 block truncate">{item.name}</span>
            <div className={`flex items-center shrink-0 gap-1 ${selectedId === item._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
              {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className={`p-1.5 rounded ${selectedId === item._id ? 'hover:bg-blue-600' : 'hover:bg-gray-200'}`}><PencilIcon className="h-4 w-4" /></button>}
              {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(item._id); }} className={`p-1.5 rounded ${selectedId === item._id ? 'hover:bg-blue-600 text-white' : 'hover:bg-red-100 text-red-600'}`}><TrashIcon className="h-4 w-4" /></button>}
            </div>
          </div>
        ))}
        {!isLoading && items.length === 0 && <div className="p-4 text-sm text-gray-400">No {title.toLowerCase()} found.</div>}
      </div>
      <div className="p-2 border-t border-gray-200">
        {onAddNew && (
            <button onClick={onAddNew} disabled={disabled} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed">
            <PlusIcon className="h-5 w-5" /> Add New {title.endsWith('s') ? title.slice(0, -1) : title}
            </button>
        )}
      </div>
    </div>
  );
}