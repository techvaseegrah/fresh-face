'use client';

import React, { 
  useState, 
  useEffect, 
  useMemo, 
  useRef 
} from 'react';

import { 
  useRouter, 
  useSearchParams 
} from 'next/navigation';

import {
  Plus, Edit, Trash, Search, Filter, RefreshCw, X, Users, UserCheck, 
  UserX, Phone, Home, CreditCard, Calendar, Briefcase, AtSign, Badge,
  FileText, Banknote, ShieldCheck, XCircle, UserPlus, Trash2,
  // ✅ ICONS FOR PASSWORD MODAL
  Key, Eye, EyeOff
} from 'lucide-react';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { 
  useStaff, 
  StaffMember,
  UpdateStaffPayload 
} from '../../../../../context/StaffContext';

import Button from '../../../../../components/ui/Button';
import { useSession } from 'next-auth/react';
import { PERMISSIONS, hasPermission } from '@/lib/permissions'; 

//================================================================================
// 1. NEW COMPONENT: Reset Password Modal
//================================================================================
const ResetPasswordModal: React.FC<{
  staff: StaffMember;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  isProcessing: boolean;
}> = ({ staff, onClose, onConfirm, isProcessing }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    onConfirm(password);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-in fade-in-0 zoom-in-95" 
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6 text-center">
            <h2 className="text-xl font-bold text-slate-800">Reset Password</h2>
            <p className="text-sm text-slate-500 mt-1">
              For: <span className="font-semibold">{staff.name}</span>
            </p>
          </div>
          
          <div className="px-6 pb-4">
            <label htmlFor="new-password"
                   className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-black focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Min. 6 characters"
                minLength={6}
                required
                disabled={isProcessing}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-4 flex justify-end items-center space-x-3 rounded-b-lg">
            <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isProcessing} disabled={isProcessing || !password}>
              {isProcessing ? 'Resetting...' : 'Confirm Reset'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};


//================================================================================
// (No changes to DocumentViewerModal, DetailItem, StatCard, StaffCard)
//================================================================================

const DocumentViewerModal: React.FC<{ 
  src: string | null; 
  title: string; 
  onClose: () => void; 
}> = ({ src, title, onClose }) => {
    if (!src) return null;
    return (
      <div className="fixed inset-0 bg-black/75 z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button variant="ghost" onClick={onClose}><XCircle /></Button>
          </div>
          <div className="p-4">
            <img src={src} alt={title} className="w-full h-auto object-contain" />
          </div>
        </div>
      </div>
    );
};
  
const DetailItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  value: React.ReactNode 
}> = ({ icon, label, value }) => (
    <div className="flex items-start gap-4 py-3">
      <div className="flex-shrink-0 w-6 text-slate-400">{icon}</div>
      <div className="flex-1">
        <dt className="text-sm font-medium text-slate-500">{label}</dt>
        <dd className="mt-1 text-sm text-slate-900 break-words">{value}</dd>
      </div>
    </div>
);

const StatCard: React.FC<{ 
  icon: React.ReactNode; 
  title: string; 
  value: string | number; 
  color: string 
}> = ({ icon, title, value, color }) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
);

const StaffCard: React.FC<{ 
  staff: StaffMember; 
  onSelect: (staff: StaffMember) => void 
}> = ({ staff, onSelect }) => (
    <div 
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
      onClick={() => onSelect(staff)}
    >
      <div className="flex items-center gap-4">
        <img
          className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-100"
          src={staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff`}
          alt={staff.name}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 text-md truncate">{staff.name}</h3>
          <p className="text-sm text-slate-500 truncate">{staff.position}</p>
          <p className="text-xs text-slate-400 mt-1 truncate">ID: {staff.staffIdNumber || 'N/A'}</p>
        </div>
      </div>
      <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
         <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
           <Phone size={14} className="text-slate-400 flex-shrink-0"/>
           <span className="truncate">{staff.phone || 'N/A'}</span>
         </div>
         <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full flex-shrink-0 ${ staff.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>
            {staff.status.charAt(0).toUpperCase() + staff.status.slice(1)}
         </span>
      </div>
    </div>
);
  
//================================================================================
// 2. UPDATED COMPONENT: Staff Detail Sidebar
//================================================================================
interface StaffDetailSidebarProps {
  staff: StaffMember | null;
  onClose: () => void;
  onDeactivate: (staff: StaffMember) => void;
  onDeletePermanent: (staff: StaffMember) => void;
  onReactivate: (staff: StaffMember) => void;
  onViewDocument: (src: string, title: string) => void;
  onResetPassword: (staff: StaffMember) => void; // ✅ Prop for reset password
  isProcessing: string | null;
  canUpdate: boolean;
  canDelete: boolean;
  canDeletePermanent: boolean;
}
  
const StaffDetailSidebar: React.FC<StaffDetailSidebarProps> = ({ 
  staff, 
  onClose, 
  onDeactivate, 
  onDeletePermanent, 
  onReactivate, 
  onViewDocument,
  onResetPassword, // ✅ Receive prop
  isProcessing, 
  canUpdate, 
  canDelete,
  canDeletePermanent
}) => {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
  
    useEffect(() => {
      if (staff) {
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
      } else {
        setIsVisible(false);
      }
    }, [staff]);
  
    if (!staff) {
      return null;
    }
  
    const handleClose = () => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    };
    
    const isCurrentlyProcessing = isProcessing === staff.id;
  
    return (
      <>
        <div
          className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={handleClose}
          aria-hidden="true"
        ></div>
  
        <div
          className={`fixed top-0 right-0 h-full w-full max-w-lg bg-slate-50 shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sidebar-title"
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
            <h2 id="sidebar-title" className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Briefcase size={20} className="text-indigo-600" />
              Staff Profile
            </h2>
            <Button variant="ghost" onClick={handleClose} aria-label="Close panel">
              <X size={24} />
            </Button>
          </div>
  
          <div className="flex-1 p-6 space-y-8 overflow-y-auto">
            <div className="flex flex-col items-center text-center">
              <img className="h-28 w-28 rounded-full object-cover ring-4 ring-white shadow-md" src={staff.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff`} alt={staff.name} />
              <h3 className="mt-4 text-2xl font-bold text-slate-900">{staff.name}</h3>
              <p className="text-md text-slate-500">{staff.position}</p>
              <span className={`mt-2 px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${ staff.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>
                  {staff.status.charAt(0).toUpperCase() + staff.status.slice(1)}
              </span>
            </div>
  
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h4 className="text-md font-semibold text-slate-800 mb-2">Contact & Personal Information</h4>
              <dl className="divide-y divide-slate-200">
                <DetailItem icon={<AtSign size={20}/>} label="Email" value={<a href={`mailto:${staff.email}`} className="text-indigo-600 hover:underline">{staff.email || 'N/A'}</a>} />
                <DetailItem icon={<Phone size={20}/>} label="Phone" value={staff.phone || 'N/A'} />
                <DetailItem icon={<Home size={20}/>} label="Address" value={staff.address || 'N/A'} />
              </dl>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h4 className="text-md font-semibold text-slate-800 mb-2">Employment Details</h4>
              <dl className="divide-y divide-slate-200">
                <DetailItem icon={<Badge size={20}/>} label="Staff ID" value={staff.staffIdNumber || 'N/A'} />
                <DetailItem icon={<CreditCard size={20}/>} label="Aadhar Number" value={staff.aadharNumber || 'N/A'} />
                <DetailItem icon={<span className="font-bold text-lg">₹</span>} label="Salary" value={staff.salary ? `₹${Number(staff.salary).toLocaleString('en-IN')}` : 'N/A'} />
                <DetailItem icon={<Calendar size={20}/>} label="Joined Date" value={new Date(staff.joinDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
              </dl>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h4 className="text-md font-semibold text-slate-800 mb-2">Uploaded Documents</h4>
              <dl className="divide-y divide-slate-200">
                <DetailItem icon={<ShieldCheck size={20}/>} label="Aadhar Card" value={ staff.aadharImage ? ( <Button variant="link" size="sm" onClick={() => onViewDocument(staff.aadharImage!, 'Aadhar Card')}>View Document</Button> ) : ( 'Not Uploaded' ) } />
                <DetailItem icon={<Banknote size={20}/>} label="Bank Passbook" value={ staff.passbookImage ? ( <Button variant="link" size="sm" onClick={() => onViewDocument(staff.passbookImage!, 'Bank Passbook')}>View Document</Button> ) : ( 'Not Uploaded' ) } />
                <DetailItem icon={<FileText size={20}/>} label="Agreement" value={ staff.agreementImage ? ( <Button variant="link" size="sm" onClick={() => onViewDocument(staff.agreementImage!, 'Agreement')}>View Document</Button> ) : ( 'Not Uploaded' ) } />
              </dl>
            </div>
          </div>
  
          {/* ✅ UPDATED FOOTER SECTION */}
          <footer className="p-4 border-t border-slate-200 bg-white flex flex-col gap-3">
            {staff.status === 'active' ? (
              <>
                <div className="flex gap-3">
                  {canUpdate && (
                    <Button variant="outline" className="flex-1" icon={<Edit size={16} />} onClick={() => router.push(`/staffmanagement/staff/editstaff?staffId=${staff.id}`)} disabled={isCurrentlyProcessing} >
                      Edit Profile
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="danger" className="flex-1" icon={isCurrentlyProcessing ? <RefreshCw className="animate-spin" size={16} /> : <Trash size={16} />} onClick={() => onDeactivate(staff)} disabled={isCurrentlyProcessing} >
                      {isCurrentlyProcessing ? 'Deactivating...' : 'Deactivate'}
                    </Button>
                  )}
                </div>
                {canUpdate && (
                  <Button variant="outline-danger" className="w-full" icon={<Key size={16} />} onClick={() => onResetPassword(staff)} disabled={isCurrentlyProcessing} >
                    Reset Password
                  </Button>
                )}
              </>
            ) : (
              <>
                {canUpdate && (
                    <Button variant="primary" className="w-full" icon={isCurrentlyProcessing ? <RefreshCw className="animate-spin" size={16} /> : <UserPlus size={16} />} onClick={() => onReactivate(staff)} disabled={isCurrentlyProcessing} >
                        {isCurrentlyProcessing ? 'Re-Activating...' : 'Re-Activate Staff'}
                    </Button>
                )}
                {canDeletePermanent && (
                    <Button variant="outline-danger" className="w-full" icon={isCurrentlyProcessing ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />} onClick={() => onDeletePermanent(staff)} disabled={isCurrentlyProcessing} >
                        {isCurrentlyProcessing ? 'Deleting...' : 'Delete Permanently'}
                    </Button>
                )}
              </>
            )}
          </footer>
        </div>
      </>
    );
};

//================================================================================
// 3. UPDATED COMPONENT: Main Staff List Page
//================================================================================
const StaffList: React.FC = () => {
  const { data: session } = useSession();
  // ✅ Make sure `updateStaffPassword` is provided by your StaffContext
  const { staffMembers, loadingStaff, errorStaff, fetchStaffMembers, deleteStaffMember, permanentlyDeleteStaffMember, updateStaffMember, updateStaffPassword } = useStaff();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ position: '', status: '' });
  const [tempFilters, setTempFilters] = useState({ position: '', status: '' });
  const filterRef = useRef<HTMLDivElement>(null);

  const [viewingDocument, setViewingDocument] = useState<{src: string | null, title: string}>({ src: null, title: '' });

  // ✅ STATE FOR THE RESET PASSWORD MODAL
  const [staffToReset, setStaffToReset] = useState<StaffMember | null>(null);

  const userPermissions = useMemo(() => session?.user?.role?.permissions || [], [session]);
  const canCreate = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_LIST_CREATE), [userPermissions]);
  const canUpdate = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_LIST_UPDATE), [userPermissions]);
  const canDelete = useMemo(() => hasPermission(userPermissions, PERMISSIONS.STAFF_LIST_DELETE), [userPermissions]);
  const canDeletePermanent = useMemo(() => hasPermission(userPermissions, "staff:permanent-delete"), [userPermissions]);
  
  useEffect(() => {
    const successAction = searchParams.get('success');
    if (successAction) {
      if (successAction === 'add') toast.success('New staff member added successfully!');
      else if (successAction === 'edit') toast.success('Staff details updated successfully!');
      router.replace('/staffmanagement/staff/stafflist');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (fetchStaffMembers) fetchStaffMembers();
  }, [fetchStaffMembers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const positions = useMemo(() => {
    if (!staffMembers) return [];
    return [...new Set(staffMembers.map(s => s.position).filter((p): p is string => !!p))].sort();
  }, [staffMembers]);

  const filteredStaff = useMemo(() => {
    return (staffMembers || [])
      .filter(staff => 
        ((staff.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
         (staff.position?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
         (staff.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
         (String(staff.staffIdNumber || '').toLowerCase()).includes(searchTerm.toLowerCase())) &&
        (filters.status ? staff.status === filters.status : true) &&
        (filters.position ? staff.position === filters.position : true)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staffMembers, searchTerm, filters]);

  const handleDeactivateStaff = async (staff: StaffMember) => {
    if (window.confirm(`Are you sure you want to DEACTIVATE ${staff.name}?`)) {
      setIsProcessing(staff.id);
      try {
        await deleteStaffMember(staff.id);
        toast.success(`'${staff.name}' deactivated successfully.`);
        setSelectedStaff(null);
      } catch (apiError: any) {
        toast.error(`Failed to deactivate staff: ${apiError.message}`);
      } finally {
        setIsProcessing(null);
      }
    }
  };
  
  const handleReactivateStaff = async (staff: StaffMember) => {
      setIsProcessing(staff.id);
      try {
        await updateStaffMember(staff.id, { status: 'active' } as UpdateStaffPayload);
        toast.success(`'${staff.name}' has been re-activated.`);
        setSelectedStaff(null);
      } catch (apiError: any) {
        toast.error(`Failed to reactivate: ${apiError.message}`);
      } finally {
        setIsProcessing(null);
      }
  };

  const handleDeletePermanent = async (staff: StaffMember) => {
    if (window.confirm(`DANGER: Are you sure you want to PERMANENTLY DELETE ${staff.name}? This action cannot be undone.`)) {
      setIsProcessing(staff.id);
      try {
        await permanentlyDeleteStaffMember(staff.id);
        toast.success(`'${staff.name}' has been permanently deleted.`);
        setSelectedStaff(null);
      } catch (apiError: any) {
        toast.error(`Failed to delete staff: ${apiError.message}`);
      } finally {
        setIsProcessing(null);
      }
    }
  };
  
  // ✅ HANDLERS FOR RESET PASSWORD MODAL
  const handleOpenResetModal = (staff: StaffMember) => {
    setStaffToReset(staff);
    setSelectedStaff(null); // Close sidebar for cleaner UI
  };

  const handleCloseResetModal = () => {
    setStaffToReset(null);
  };
  
  const handleConfirmResetPassword = async (password: string) => {
    if (!staffToReset) return;

    setIsProcessing(staffToReset.id);
    try {
      if (!updateStaffPassword) {
        throw new Error("Update password function is not available in context.");
      }
      await updateStaffPassword(staffToReset.id, password);
      toast.success(`Password for ${staffToReset.name} has been reset successfully!`);
      handleCloseResetModal();
    } catch (apiError: any) {
      toast.error(`Failed to reset password: ${apiError.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const toggleFilter = () => { if (!isFilterOpen) setTempFilters(filters); setIsFilterOpen(!isFilterOpen); };
  const handleApplyFilters = () => { setFilters(tempFilters); setIsFilterOpen(false); };
  const handleResetFilters = () => { setTempFilters({ position: '', status: '' }); setFilters({ position: '', status: '' }); setIsFilterOpen(false); };

  return (
    <div className="relative">
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />
      <DocumentViewerModal src={viewingDocument.src} title={viewingDocument.title} onClose={() => setViewingDocument({ src: null, title: '' })} />
      
      {/* ✅ RENDER THE RESET PASSWORD MODAL */}
      {staffToReset && (
        <ResetPasswordModal
          staff={staffToReset}
          onClose={handleCloseResetModal}
          onConfirm={handleConfirmResetPassword}
          isProcessing={isProcessing === staffToReset.id}
        />
      )}

      <div className="bg-slate-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Staff Management</h1>
              <p className="mt-1 text-md text-slate-600">Manage, view, and organize your staff members.</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" icon={<RefreshCw size={16} className={loadingStaff ? "animate-spin" : ""} />} onClick={() => fetchStaffMembers && fetchStaffMembers()} disabled={loadingStaff} title="Refresh List" />
              {canCreate && ( <Button variant="black" icon={<Plus size={16} />} onClick={() => router.push('/staffmanagement/staff/add')} > Add Staff </Button> )}
            </div>
          </div>
          
          {errorStaff && ( <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl" role="alert"> <strong className="font-bold">Error: </strong> <span className="block sm:inline">{errorStaff}</span> </div> )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <StatCard icon={<Users size={24} className="text-indigo-600"/>} title="Total Staff" value={staffMembers?.length || 0} color="bg-indigo-100" />
            <StatCard icon={<UserCheck size={24} className="text-green-600"/>} title="Active" value={staffMembers?.filter(s => s.status === 'active').length || 0} color="bg-green-100" />
            <StatCard icon={<UserX size={24} className="text-red-600"/>} title="Inactive" value={staffMembers?.filter(s => s.status === 'inactive').length || 0} color="bg-red-100" />
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"> <Search className="w-5 h-5 text-slate-400" /> </div>
              <input type="text" placeholder="Search by name, ID, position..." className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="relative" ref={filterRef}>
              <Button variant="outline" icon={<Filter size={16} />} className="w-full md:w-auto" onClick={toggleFilter}> Filter { (filters.position || filters.status) && <span className="ml-2 h-2 w-2 rounded-full bg-indigo-500"></span> } </Button>
              {isFilterOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-30 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-md font-semibold text-slate-800 border-b pb-2">Filter Options</h3>
                    <div>
                        <label htmlFor="position-filter" className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                        <select id="position-filter" name="position" value={tempFilters.position} onChange={(e) => setTempFilters({...tempFilters, position: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900">
                            <option value="">All Positions</option>
                            {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                        <fieldset className="flex items-center space-x-4">
                           {['', 'active', 'inactive'].map(status => (
                             <div key={status || 'all'} className="flex items-center">
                               <input id={`status-${status || 'all'}`} name="status" type="radio" value={status} checked={tempFilters.status === status} onChange={(e) => setTempFilters({...tempFilters, status: e.target.value})} className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                               <label htmlFor={`status-${status || 'all'}`} className="ml-2 block text-sm text-slate-900">{status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}</label>
                             </div>
                           ))}
                        </fieldset>
                    </div>
                    <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                        <Button variant="ghost" onClick={handleResetFilters}>Reset</Button>
                        <Button variant="black" onClick={handleApplyFilters}>Apply</Button>
                    </div>
                </div>
              )}
            </div>
          </div>
          
          {loadingStaff && !staffMembers?.length ? (
              <div className="text-center py-20"> <RefreshCw className="h-10 w-10 text-slate-400 mx-auto animate-spin mb-3" /> <p className="text-slate-500 text-lg">Loading staff members...</p> </div>
          ) : filteredStaff.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredStaff.map((staff) => ( <StaffCard key={staff.id} staff={staff} onSelect={setSelectedStaff} /> ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
              <h3 className="text-xl font-semibold text-slate-700">No Staff Found</h3>
              <p className="text-slate-500 mt-2"> {searchTerm || filters.position || filters.status ? 'Try adjusting your search or filter criteria.' : 'Add a new staff member to get started.'} </p>
            </div>
          )}
        </div>
      </div>

      <StaffDetailSidebar 
        staff={selectedStaff}
        onClose={() => setSelectedStaff(null)}
        onDeactivate={handleDeactivateStaff}
        onDeletePermanent={handleDeletePermanent}
        onReactivate={handleReactivateStaff}
        onViewDocument={(src, title) => setViewingDocument({ src, title })}
        onResetPassword={handleOpenResetModal} // ✅ Pass the handler to the sidebar
        isProcessing={isProcessing}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canDeletePermanent={canDeletePermanent}
      />
    </div>
  );
};

export default StaffList;