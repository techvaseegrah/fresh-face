'use client';

import React, { useState, useEffect } from 'react';

// --- Types ---
interface ShopInfo {
  shopName: string;
  email: string;
  phone: string;
  flatDoorNo: string;
  street: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  mobileNumber: string;
  landlineNumber: string;
  website: string;
  gstNumber: string;
  companySize: string;
}

interface AttendanceSettings {
  dailyHours: number;
  otRate: number;
  extraDayRate: number;
}

const initialShopInfo: ShopInfo = {
  shopName: 'FF Project',
  email: 'contact@ffproject.com',
  phone: '9876543210',
  flatDoorNo: '',
  street: '',
  district: '',
  state: '',
  country: 'India',
  pincode: '',
  mobileNumber: '9876543210',
  landlineNumber: '',
  website: '',
  gstNumber: '',
  companySize: '1-10 employees',
};

// --- Reusable Button Component ---
const Button = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
        {...props}
    >
        {children}
    </button>
);


// --- Sub-component for Shop Information Form ---
const ShopInformationForm: React.FC = () => {
    const [info, setInfo] = useState<ShopInfo>(initialShopInfo);
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setInfo({ ...info, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        console.log("Saving Shop Information:", info);
        // This is a mock save. In a real app, you'd have an API for this too.
        setTimeout(() => {
            setIsSaving(false);
            alert("Shop information saved! (Mocked)");
        }, 1000);
    };

    const InputField = ({ label, name, value, optional = false }: { label: string; name: string; value: string; optional?: boolean }) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">
                {label} {optional && <span className="text-gray-500">(Optional)</span>}
            </label>
            <input
                type="text" id={name} name={name} value={value} onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900"
            />
        </div>
    );

    return (
        <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Shop Information</h2>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <InputField label="Shop Name" name="shopName" value={info.shopName} />
                    <InputField label="Email" name="email" value={info.email} />
                    {/* Add other fields here as needed */}
                </div>
                <div className="mt-8 flex justify-end">
                    <Button type="submit" disabled={isSaving} className="bg-black hover:bg-gray-800 focus:ring-gray-500">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </div>
    );
};


// --- Sub-component for Attendance Settings Form ---
const AttendanceSettingsForm: React.FC = () => {
    const [settings, setSettings] = useState<AttendanceSettings>({ dailyHours: 8, otRate: 0, extraDayRate: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                // In a real app, this API would fetch your settings
                const response = await fetch('/api/settings');
                const result = await response.json();
                if (result.success && result.data) {
                    setSettings({
                        dailyHours: result.data.defaultDailyHours,
                        otRate: result.data.defaultOtRate,
                        extraDayRate: result.data.defaultExtraDayRate,
                    });
                } else {
                    console.error("Failed to fetch settings:", result.error);
                }
            } catch (error) {
                console.error("An error occurred while fetching settings:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings({ ...settings, [e.target.name]: e.target.valueAsNumber || 0 });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                defaultDailyHours: settings.dailyHours,
                defaultOtRate: settings.otRate,
                defaultExtraDayRate: settings.extraDayRate,
            };
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (result.success) {
                alert("Attendance settings saved successfully!");
            } else {
                alert(`Failed to save settings: ${result.error}`);
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("An unexpected error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading settings...</div>;
    }

    return (
        <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Attendance Requirements</h2>
            <p className="text-sm text-gray-600 mb-8">Set defaults for salary calculations. Only admins can modify these.</p>
            <form onSubmit={handleSubmit} className="max-w-md">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="dailyHours" className="block text-sm font-medium text-gray-700">Default Daily Working Hours</label>
                        <input type="number" id="dailyHours" name="dailyHours" value={settings.dailyHours} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900" />
                        <p className="text-xs text-gray-500 mt-1">Used to calculate overtime from total clocked-in time.</p>
                    </div>
                    <div>
                        <label htmlFor="otRate" className="block text-sm font-medium text-gray-700">Default OT Rate per Hour (₹)</label>
                        <input type="number" id="otRate" name="otRate" value={settings.otRate} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900" />
                        <p className="text-xs text-gray-500 mt-1">Used to calculate the overtime amount for staff.</p>
                    </div>
                    <div>
                        <label htmlFor="extraDayRate" className="block text-sm font-medium text-gray-700">Default Extra Day Rate (₹)</label>
                        <input type="number" id="extraDayRate" name="extraDayRate" value={settings.extraDayRate} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900" />
                        <p className="text-xs text-gray-500 mt-1">Used to calculate the payment for working on an extra day/holiday.</p>
                    </div>
                </div>
                <div className="mt-8 flex justify-start">
                    <Button type="submit" disabled={isSaving || isLoading} className="bg-black hover:bg-gray-800 focus:ring-gray-500">
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </div>
            </form>
        </div>
    );
};


// --- Main Page Component ---
const SettingsPage = () => {
    // Defaulting to 'shop' as 'attendance' was the default before
    const [activeTab, setActiveTab] = useState('shop');

    // --- MODIFIED ---
    // Removed the 'loyalty' tab
    const settingsTabs = [
        { id: 'shop', label: 'Shop Information' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'billing', label: 'Billing', disabled: true },
        { id: 'integrations', label: 'Integrations', disabled: true },
    ];

    const renderContent = () => {
        // --- MODIFIED ---
        // Removed the 'loyalty' case
        switch (activeTab) {
            case 'shop': return <ShopInformationForm />;
            case 'attendance': return <AttendanceSettingsForm />;
            default: return (
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Coming Soon</h2>
                    <p className="mt-2 text-gray-600">This settings section is not yet available.</p>
                </div>
            );
        }
    };

    return (
        <div className="bg-white">
          <div className="flex flex-col md:flex-row min-h-screen">
            <aside className="w-full md:w-[240px] border-b md:border-b-0 md:border-r border-gray-200 flex-shrink-0">
              <div className="p-4">
                <ul className="space-y-1">
                  {settingsTabs.map(tab => (
                    <li key={tab.id}>
                      <button
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                        disabled={tab.disabled}
                        className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === tab.id ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'} ${tab.disabled ? 'text-gray-400 cursor-not-allowed hover:bg-transparent' : ''}`}
                      >
                        {tab.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
            <main className="w-full">
              <div className="p-6 md:p-8 h-full">
                {renderContent()}
              </div>
            </main>
          </div>
        </div>
    );
};

export default SettingsPage;