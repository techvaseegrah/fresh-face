// src/app/staffmanagement/staff/stafflist/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Edit, Trash, MoreVertical, Search,
  Eye, Filter, RefreshCw
} from 'lucide-react';
import { useStaff, StaffMember } from '../../../../../context/StaffContext';
import Button from '../../../../../components/ui/Button';

const DEFAULT_STAFF_AVATAR = '/default-avatar.png';

const StaffList: React.FC = () => {
  const {
    staffMembers,
    loadingStaff,
    errorStaff,
    fetchStaffMembers,
    deleteStaffMember
  } = useStaff();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdownId, setShowDropdownId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ position: '', status: '' });
  const [tempFilters, setTempFilters] = useState({ position: '', status: '' });
  const filterRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (fetchStaffMembers) {
      fetchStaffMembers();
    }
  }, [fetchStaffMembers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const positions = useMemo(() => {
    if (!staffMembers) return [];
    const allPositions = staffMembers
      .map((s) => s.position)
      .filter((p): p is string => !!p);
    return [...new Set(allPositions)].sort();
  }, [staffMembers]);


  const filteredStaff = useMemo(() => {
    return (staffMembers || [])
      .filter((staff) => {
        const searchMatch =
          (staff.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
          (staff.position?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
          (staff.email?.toLowerCase() || "").includes(searchTerm.toLowerCase());

        const statusMatch = filters.status ? staff.status === filters.status : true;
        const positionMatch = filters.position ? staff.position === filters.position : true;

        return searchMatch && statusMatch && positionMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staffMembers, searchTerm, filters]);


  const handleDeleteStaff = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to deactivate staff member: ${name}? Their status will be set to 'inactive'.`)) {
      setIsDeleting(id);
      try {
        await deleteStaffMember(id);
      } catch (apiError: any) {
        alert(`Failed to deactivate staff: ${apiError.message || 'Unknown error'}`);
        console.error("Delete error", apiError);
      } finally {
        setShowDropdownId(null);
        setIsDeleting(null);
        if (fetchStaffMembers) fetchStaffMembers();
      }
    }
  };

  const toggleDropdown = (id: string) => {
    setShowDropdownId(prevId => (prevId === id ? null : id));
  };
  
  const toggleFilter = () => {
    if (!isFilterOpen) {
      setTempFilters(filters);
    }
    setIsFilterOpen(!isFilterOpen);
  };

  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    setTempFilters({ position: '', status: '' });
  };


  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
           <Button
            variant="outline"
            icon={<RefreshCw size={16} className={loadingStaff ? "animate-spin" : ""} />}
            onClick={() => fetchStaffMembers && fetchStaffMembers()}
            disabled={loadingStaff}
            title="Refresh List"
          >
            {loadingStaff ? "Refreshing..." : "Refresh"}
          </Button>
          {/* --- CHANGE: Button variant is now "black" --- */}
          <Button
            variant="black"
            icon={<Plus size={16} />}
            onClick={() => router.push('/staffmanagement/staff/add')}
          >
            Add New Staff
          </Button>
        </div>
      </div>

      {errorStaff && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{errorStaff}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-4 pb-4 border-b border-gray-200">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          {/* --- CHANGE: Focus ring color is now black --- */}
          <input
            type="text"
            placeholder="Search by name, position, email..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-gray-900 placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative" ref={filterRef}>
          <Button
            variant="outline"
            icon={<Filter size={16} />}
            className="w-full md:w-auto"
            onClick={toggleFilter}
          >
            Filter
          </Button>
           {isFilterOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-30 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-md font-semibold text-gray-800 border-b pb-2">Filter Options</h3>
                
                <div>
                    <label htmlFor="position-filter" className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    {/* --- CHANGE: Focus ring color is now black --- */}
                    <select
                        id="position-filter"
                        name="position"
                        value={tempFilters.position}
                        onChange={(e) => setTempFilters({...tempFilters, position: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black sm:text-sm text-gray-900"
                    >
                        <option value="">All Positions</option>
                        {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    {/* --- CHANGE: Focus ring color is now black --- */}
                    <fieldset className="flex items-center space-x-4">
                        <div className="flex items-center">
                            <input id="status-all" name="status" type="radio" value="" checked={tempFilters.status === ''} onChange={(e) => setTempFilters({...tempFilters, status: e.target.value})} className="h-4 w-4 text-black border-gray-300 focus:ring-black" />
                            <label htmlFor="status-all" className="ml-2 block text-sm text-gray-900">All</label>
                        </div>
                        <div className="flex items-center">
                            <input id="status-active" name="status" type="radio" value="active" checked={tempFilters.status === 'active'} onChange={(e) => setTempFilters({...tempFilters, status: e.target.value})} className="h-4 w-4 text-black border-gray-300 focus:ring-black" />
                            <label htmlFor="status-active" className="ml-2 block text-sm text-gray-900">Active</label>
                        </div>
                        <div className="flex items-center">
                            <input id="status-inactive" name="status" type="radio" value="inactive" checked={tempFilters.status === 'inactive'} onChange={(e) => setTempFilters({...tempFilters, status: e.target.value})} className="h-4 w-4 text-black border-gray-300 focus:ring-black" />
                            <label htmlFor="status-inactive" className="ml-2 block text-sm text-gray-900">Inactive</label>
                        </div>
                    </fieldset>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                    <Button variant="outline" onClick={handleResetFilters}>Reset</Button>
                    {/* --- CHANGE: Apply button variant is now "black" --- */}
                    <Button variant="black" onClick={handleApplyFilters}>Apply</Button>
                </div>
            </div>
          )}
        </div>
      </div>

      {loadingStaff && !staffMembers?.length ? (
          <div className="text-center py-10">
            <RefreshCw className="h-8 w-8 text-gray-400 mx-auto animate-spin mb-2" />
            <p className="text-gray-500">Loading staff members...</p>
          </div>
      ) : (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((staff: StaffMember) => (
                  <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={staff.image || DEFAULT_STAFF_AVATAR}
                            alt={staff.name}
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                          <div className="text-sm text-gray-500 truncate max-w-[150px] sm:max-w-xs">{staff.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{staff.position}</div>
                      <div className="text-sm text-gray-500">Joined {new Date(staff.joinDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{staff.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        staff.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {staff.status.charAt(0).toUpperCase() + staff.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        {/* --- CHANGE: Focus ring color is now black --- */}
                        <button
                          onClick={() => toggleDropdown(staff.id)}
                          className="text-gray-500 hover:text-black p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
                          aria-haspopup="true"
                          aria-expanded={showDropdownId === staff.id}
                        >
                          <MoreVertical size={20} />
                        </button>

                        {showDropdownId === staff.id && (
                          <div
                            className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 focus:outline-none"
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby={`menu-button-${staff.id}`}
                            onMouseLeave={() => setShowDropdownId(null)}
                          >
                            <div className="py-1" role="none">
                              <Link
                                href={`/staffmanagement/staff/staffdetail?staffId=${staff.id}`}
                                className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                role="menuitem"
                                onClick={() => setShowDropdownId(null)}
                              >
                                <Eye className="mr-3 h-4 w-4 text-gray-500" />
                                View Details
                              </Link>
                              <Link
                                href={`/staffmanagement/staff/editstaff?staffId=${staff.id}`}
                                className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                role="menuitem"
                                onClick={() => setShowDropdownId(null)}
                              >
                                <Edit className="mr-3 h-4 w-4 text-gray-500" />
                                Edit
                              </Link>
                              <button
                                onClick={() => handleDeleteStaff(staff.id, staff.name)}
                                className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                role="menuitem"
                                disabled={isDeleting === staff.id}
                              >
                                {isDeleting === staff.id ? (
                                    <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash className="mr-3 h-4 w-4" />
                                )}
                                {isDeleting === staff.id ? 'Deactivating...' : 'Deactivate'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                     {searchTerm || filters.position || filters.status ? 'No staff members match your filter criteria.' : 'No staff members found. Add one to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
         {(filteredStaff.length > 0 || staffMembers?.length > 0) && (
            <div className="px-6 py-3 text-xs text-gray-500 border-t border-gray-200">
                Total: {staffMembers?.length || 0} | Active: {staffMembers?.filter(s => s.status === 'active').length || 0} | Inactive: {staffMembers?.filter(s => s.status === 'inactive').length || 0}
                {(searchTerm || filters.position || filters.status) && ` (Showing ${filteredStaff.length} matching results)`}
            </div>
        )}
      </div>
      )}
    </div>
  );
};

export default StaffList;