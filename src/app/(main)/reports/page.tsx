// src/app/(main)/reports/page.tsx

import Card from '@/components/ui/Card'; // Make sure this import path is correct

export default function ReportsHomePage() {
  return (
    // This Card component provides the white background for the content area,
    // matching the style of the other individual report pages.
    <Card>
      <div className="flex flex-col space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Reports Dashboard
        </h2>
        <p className="text-gray-600">
          Welcome to the reports section.
        </p>
        <p className="text-gray-500">
          Please select a specific report from the menu on the left to view its details.
        </p>
      </div>
    </Card>
  );
}