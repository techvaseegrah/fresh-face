import React from 'react';
import PackageTemplateList from './components/PackageTemplateList';

// This is a Server Component that renders our main Client Component
export default function PackagesSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Manage Packages</h1>
      <div className="mt-4">
        <PackageTemplateList />
      </div>
    </div>
  );
}