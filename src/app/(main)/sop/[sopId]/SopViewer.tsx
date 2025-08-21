'use client';

import { FileText, ListChecks } from 'lucide-react';
import DOMPurify from 'dompurify';

export default function SopViewer({ sop }) {
  // Sanitize HTML content before rendering to prevent XSS attacks
  const sanitizedContent = typeof window !== 'undefined' ? DOMPurify.sanitize(sop.content) : sop.content;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center gap-4 mb-4">
          {sop.type === 'checklist' ? <ListChecks className="text-blue-500" size={32} /> : <FileText className="text-green-500" size={32} />}
          <h1 className="text-3xl font-bold">{sop.title}</h1>
        </div>
        <p className="text-lg text-gray-600 mb-6">{sop.description}</p>
        <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Assigned Roles:</h4>
            <div className="flex flex-wrap gap-2">
            {sop.roles.map(role => (
                <span key={role._id} className="text-sm bg-gray-200 text-gray-800 px-3 py-1 rounded-full">{role.displayName}</span>
            ))}
            </div>
        </div>

        <hr className="my-8" />
        
        {sop.type === 'document' && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Procedure Steps</h2>
            <div
              className="prose lg:prose-xl max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
          </div>
        )}

        {sop.type === 'checklist' && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Daily Checklist Items</h2>
            <ul className="list-disc list-inside space-y-2">
              {sop.checklistItems.map((item, index) => (
                <li key={index} className="text-gray-800 text-lg">{item.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}