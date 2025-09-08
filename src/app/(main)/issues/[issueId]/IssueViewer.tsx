// src/app/(main)/issues/[issueId]/IssueViewer.tsx

'use client';

import { ListChecks, Check, MessageSquare, Paperclip } from 'lucide-react';

interface IssueData {
  _id: string;
  title: string;
  description: string;
  roles: { _id: string; displayName: string }[];
  checklistItems: {
    _id: string;
    questionText: string;
    responseType: 'yes_no' | 'yes_no_remarks';
    mediaUpload: 'none' | 'optional' | 'required';
  }[];
}

// Use a named export
export function IssueViewer({ issue }: { issue: IssueData }) {
  if (!issue) return null;

  const getMediaUploadText = (mediaUpload: string) => {
    switch (mediaUpload) {
      case 'required': return 'Media Required';
      case 'optional': return 'Media Optional';
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center gap-4 mb-4">
          <ListChecks className="text-blue-500 h-8 w-8 flex-shrink-0" />
          <h1 className="text-3xl font-bold text-gray-800">{issue.title}</h1>
        </div>
        {issue.description && (<p className="text-lg text-gray-600 mb-6">{issue.description}</p>)}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Assigned Roles</h2>
          <div className="flex flex-wrap gap-2">
            {issue.roles.map((role) => (
              <span key={role._id} className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded-full">{role.displayName}</span>
            ))}
          </div>
        </div>
        <hr className="my-8" />
        <div>
          <h2 className="text-2xl font-semibold mb-4">Checklist Questions</h2>
          {issue.checklistItems && issue.checklistItems.length > 0 ? (
            <ul className="space-y-4">
              {issue.checklistItems.map((item) => (
                <li key={item._id} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <p className="flex-1 text-gray-800">{item.questionText}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pl-8">
                    {item.responseType === 'yes_no_remarks' && ( <span className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded-full"><MessageSquare size={12} /> Remarks Enabled</span>)}
                    {item.mediaUpload !== 'none' && (<span className={`flex items-center gap-1.5 text-xs ${item.mediaUpload === 'required' ? 'text-red-700 bg-red-100' : 'text-indigo-700 bg-indigo-100'} px-2 py-1 rounded-full`}><Paperclip size={12} /> {getMediaUploadText(item.mediaUpload)}</span>)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (<p className="text-gray-500">No checklist items have been defined for this issue.</p>)}
        </div>
      </div>
    </div>
  );
}