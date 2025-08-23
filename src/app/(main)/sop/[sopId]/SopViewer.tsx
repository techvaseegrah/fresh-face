'use client';

import { ListChecks, Check } from 'lucide-react';

// Define a more specific type for the sop prop for better code quality
interface SopData {
  _id: string;
  title: string;
  description: string;
  roles: { _id: string; displayName: string }[];
  checklistItems: { text: string }[];
}

export default function SopViewer({ sop }: { sop: SopData }) {
  if (!sop) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-4">
          <ListChecks className="text-blue-500 h-8 w-8 flex-shrink-0" />
          <h1 className="text-3xl font-bold text-gray-800">{sop.title}</h1>
        </div>

        {/* Description */}
        {sop.description && (
          <p className="text-lg text-gray-600 mb-6">{sop.description}</p>
        )}

        {/* Assigned Roles */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Assigned Roles</h2>
          <div className="flex flex-wrap gap-2">
            {sop.roles.map((role) => (
              <span key={role._id} className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded-full">
                {role.displayName}
              </span>
            ))}
          </div>
        </div>

        <hr className="my-8" />
        
        {/* Display the list of checklist items */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Checklist Items</h2>
          {sop.checklistItems && sop.checklistItems.length > 0 ? (
            <ul className="space-y-3">
              {sop.checklistItems.map((item, index) => (
                <li key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-800">{item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            // Show this message if the array is empty
            <p className="text-gray-500">No checklist items have been defined for this SOP.</p>
          )}
        </div>
      </div>
    </div>
  );
}