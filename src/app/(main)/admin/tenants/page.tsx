'use client';

import { useState, useEffect, FormEvent, FC, ReactNode } from 'react';
import Link from 'next/link';

// --- TYPE DEFINITIONS ---
interface Tenant {
  _id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  // This assumes your API can provide admin details for pre-filling the edit form
  admin?: {
    name: string;
    email: string;
  };
}

// --- HELPER ICON COMPONENTS ---

// Search icon for the search bar
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
);

// Eye icon for showing password
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

// Slashed eye icon for hiding password
const EyeSlashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" />
    </svg>
);

// Generic Modal component
const Modal: FC<{ show: boolean; onClose: () => void; title: string; children: ReactNode }> = ({ show, onClose, title, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);

  // State for selected tenant
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // State for forms
  const [storeName, setStoreName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changePassword, setChangePassword] = useState(false); // Only for Edit modal
  
  // General Action State
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch tenants from API
  const fetchTenants = async () => {
    setListLoading(true);
    try {
      const response = await fetch('/api/admin/tenants');
      if (!response.ok) throw new Error('Failed to fetch stores.');
      const data = await response.json();
      setTenants(data);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to load stores.' });
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Filter tenants based on search query
  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset all form and message states
  const resetAllStates = () => {
    setStoreName('');
    setAdminName('');
    setAdminEmail('');
    setAdminPassword('');
    setShowPassword(false);
    setChangePassword(false);
    setSelectedTenant(null);
    setMessage(null);
  };
  
  // Handlers for opening modals
  const handleOpenCreateModal = () => {
    resetAllStates();
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (tenant: Tenant) => {
    resetAllStates();
    setSelectedTenant(tenant);
    setStoreName(tenant.name);
    setAdminName(tenant.admin?.name || '');
    setAdminEmail(tenant.admin?.email || '');
    setEditModalOpen(true);
  };

  const handleOpenDeleteModal = (tenant: Tenant) => {
    resetAllStates();
    setSelectedTenant(tenant);
    setDeleteModalOpen(true);
  };

  // Close all modals and reset state
  const closeModal = () => {
    setCreateModalOpen(false);
    setEditModalOpen(false);
    setDeleteModalOpen(false);
    resetAllStates();
  };
  
  // --- FORM SUBMISSION HANDLERS ---
  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, adminName, adminEmail, adminPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to create store.');

      setMessage({ type: 'success', text: `Store "${result.tenant.name}" created successfully!` });
      fetchTenants();
      setTimeout(closeModal, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setLoading(true);
    setMessage(null);

    const updateData: any = {
        name: storeName,
        admin: { name: adminName, email: adminEmail },
    };

    if (changePassword) {
        if (!adminPassword) {
            setMessage({ type: 'error', text: 'New password cannot be empty.' });
            setLoading(false);
            return;
        }
        updateData.password = adminPassword;
    }

    try {
        const response = await fetch(`/api/admin/tenants/${selectedTenant._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to update store.');
        
        setMessage({ type: 'success', text: 'Store updated successfully!' });
        fetchTenants();
        setTimeout(closeModal, 2000);
    } catch (error: any) {
        setMessage({ type: 'error', text: error.message });
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedTenant) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/tenants/${selectedTenant._id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to delete store.');
      }
      setMessage({ type: 'success', text: `Store "${selectedTenant.name}" has been deleted.` });
      fetchTenants();
      setTimeout(closeModal, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // --- JSX RENDER ---
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Store Management</h1>
        <button onClick={handleOpenCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          Create New Store
        </button>
      </div>
      
      <div className="mb-8">
          <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <SearchIcon />
              </span>
              <input
                  type="text"
                  placeholder="Search for a store by name or subdomain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
          </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Existing Stores</h2>
        {listLoading ? <p>Loading stores...</p> : (
          <div className="space-y-4">
            {filteredTenants.length === 0 ? (
              <p className='text-center py-4 text-gray-500'>No stores found.</p>
            ) : filteredTenants.map((tenant) => (
              <div key={tenant._id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow duration-300 flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium text-gray-900">{tenant.name}</p>
                  <p className="text-sm text-gray-500">{tenant.subdomain}.yourdomain.com</p>
                </div>
                <div className="flex items-center gap-4">
                  <Link href={`/sales-report/${tenant._id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    View Sales Report
                  </Link>
                  <button onClick={() => handleOpenEditModal(tenant)} className="text-sm font-medium text-green-600 hover:text-green-800">Edit</button>
                  <button onClick={() => handleOpenDeleteModal(tenant)} className="text-sm font-medium text-red-600 hover:text-red-800">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      <Modal show={isCreateModalOpen} onClose={closeModal} title="Create a New Store">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
           <div>
             <label className="block text-gray-700 font-bold mb-2" htmlFor="createStoreName">Store Name</label>
             <input id="createStoreName" type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
           </div>
           <hr className="my-2" />
           <h3 className="text-xl font-semibold pt-2">Store Administrator Account</h3>
           <div>
             <label className="block text-gray-700 font-bold mb-2" htmlFor="createAdminName">Admin's Full Name</label>
             <input id="createAdminName" type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
           </div>
           <div>
             <label className="block text-gray-700 font-bold mb-2" htmlFor="createAdminEmail">Admin's Email (Login ID)</label>
             <input id="createAdminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
           </div>
           <div>
             <label className="block text-gray-700 font-bold mb-2" htmlFor="createAdminPassword">Temporary Password</label>
              <div className="relative">
                <input id="createAdminPassword" type={showPassword ? 'text' : 'password'} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg pr-10" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700">
                  {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
           </div>
            {message && <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
           <div className="flex items-center justify-end gap-4 pt-4">
              <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
              <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400">
                {loading ? 'Creating...' : 'Create Store'}
              </button>
           </div>
        </form>
      </Modal>

      <Modal show={isEditModalOpen} onClose={closeModal} title={`Edit ${selectedTenant?.name}`}>
        <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
                <label className="block text-gray-700 font-bold mb-2" htmlFor="editStoreName">Store Name</label>
                <input id="editStoreName" type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
             <div>
               <label className="block text-gray-700 font-bold mb-2" htmlFor="editAdminName">Admin's Full Name</label>
               <input id="editAdminName" type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
             </div>
             <div>
               <label className="block text-gray-700 font-bold mb-2" htmlFor="editAdminEmail">Admin's Email (Login ID)</label>
               <input id="editAdminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
             </div>
            <hr className="my-2" />
            <div className="flex items-center">
                <input id="changePassword" type="checkbox" checked={changePassword} onChange={(e) => setChangePassword(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                <label htmlFor="changePassword" className="ml-2 block text-sm font-medium text-gray-900">Change Password</label>
            </div>
            {changePassword && (
                <div>
                    <label className="block text-gray-700 font-bold mb-2" htmlFor="editAdminPassword">New Password</label>
                    <div className="relative">
                        <input id="editAdminPassword" type={showPassword ? 'text' : 'password'} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg pr-10" required={changePassword} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700">
                            {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                    </div>
                </div>
            )}
            {message && <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
            <div className="flex items-center justify-end gap-4 pt-4">
               <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
               <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400">
                 {loading ? 'Updating...' : 'Update Store'}
               </button>
            </div>
        </form>
      </Modal>

      <Modal show={isDeleteModalOpen} onClose={closeModal} title={`Delete ${selectedTenant?.name}`}>
        <p className="text-gray-700 mb-6">Are you sure you want to permanently delete this store? This action cannot be undone.</p>
        {message && <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
        <div className="flex items-center justify-end gap-4">
          <button onClick={closeModal} disabled={loading} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-lg">Cancel</button>
          <button onClick={handleDeleteSubmit} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400">
            {loading ? 'Deleting...' : 'Delete Store'}
          </button>
        </div>
      </Modal>
    </div>
  );
}