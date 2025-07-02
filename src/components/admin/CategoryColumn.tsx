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

const ListSkeleton = () => (
    <div className="p-2 space-y-1 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-gray-200 w-full"></div>
      ))}
    </div>
  );

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
    <div className="flex flex-col w-full h-full bg-white">
      {/* Column Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <h3 className="font-semibold text-lg text-gray-800">{title}</h3>
      </div>

      {/* Items List and Add Button - This entire container scrolls */}
      <div className="flex-grow overflow-y-auto p-2">
        {isLoading && <ListSkeleton />}

        {!isLoading && disabled && (
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-sm text-center text-gray-500">{disabledText}</p>
          </div>
        )}

        {!isLoading && !disabled && (
          <>
            {/* The List of Items */}
            {items.length > 0 ? (
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item._id}>
                    <button
                      onClick={() => onSelect(item._id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors group flex justify-between items-center
                        ${ selectedId === item._id
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                    >
                      <span className="font-medium truncate">{item.name}</span>
                      <div className={`flex items-center gap-1 transition-opacity
                        ${ selectedId === item._id
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`
                      }>
                        {onEdit && (
                          <div 
                            onClick={(e) => { e.stopPropagation(); onEdit(item); }} 
                            className={`p-1.5 rounded-full ${selectedId === item._id ? 'hover:bg-indigo-500' : 'hover:bg-gray-200'}`}
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </div>
                        )}
                        {onDelete && (
                           <div 
                             onClick={(e) => { e.stopPropagation(); onDelete(item._id); }} 
                             className={`p-1.5 rounded-full ${selectedId === item._id ? 'hover:bg-indigo-500' : 'hover:bg-gray-200 text-red-500'}`}
                             title="Delete"
                           >
                            <TrashIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              // Empty State message
              <div className="p-4 text-sm text-center text-gray-400">
                No {title.toLowerCase()} found.
              </div>
            )}

            {/* The Add New Button, positioned after the list */}
            {onAddNew && (
              <div className="mt-2">
                <button 
                  onClick={onAddNew} 
                  disabled={disabled} 
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <PlusIcon className="h-5 w-5" /> Add New {title.endsWith('s') ? title.slice(0, -1) : title}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}