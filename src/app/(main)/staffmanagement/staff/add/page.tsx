"use client";

import React, { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Save, Upload, PlusCircle, XCircle, Eye, Trash2, FileText,
  Banknote, ShieldCheck, User, Mail, Phone, Fingerprint, Briefcase,
  Calendar, IndianRupee, MapPin, ImageIcon, Badge, EyeOff, BookCheck,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useStaff, NewStaffPayload, PositionOption } from "../../../../../context/StaffContext";
import Button from "../../../../../components/ui/Button";

interface StaffFormData {
  staffIdNumber: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  joinDate: string;
  salary: number | "";
  address: string;
  image: string | null;
  aadharNumber: string;
  aadharImage: string | null;
  passbookImage: string | null;
  agreementImage: string | null;
  password: string;
  isAvailableForBooking: boolean;
}

const DEFAULT_STAFF_IMAGE = `data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1d5db'%3e%3cpath fill-rule='evenodd' d='M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' clip-rule='evenodd' /%3e%3c/svg%3e`;

const DocumentViewerModal: React.FC<{
  src: string | null;
  title: string;
  onClose: () => void;
}> = ({ src, title, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-auto w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" onClick={onClose} className="min-h-[44px] min-w-[44px]"><XCircle /></Button>
        </div>
        <div className="p-4">
          <img src={src} alt={title} className="w-full h-auto object-contain" />
        </div>
      </div>
    </div>
  );
};

const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
          if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const FileUploadInput: React.FC<{
  id: string; label: string; icon: React.ReactNode; fileData: string | null;
  onFileChange: (file: string | null) => void; onView: () => void; isSubmitting: boolean;
}> = ({ id, label, icon, fileData, onFileChange, onView, isSubmitting }) => {
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { toast.error("File size should not exceed 5MB."); e.target.value = ""; return; }
      if (file.type.startsWith('image/')) {
        try {
          const compressedDataUrl = await compressImage(file, 1024, 1024, 0.7);
          onFileChange(compressedDataUrl);
        } catch (error) { toast.error("Failed to process image for upload."); onFileChange(null); }
      } else if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onloadend = () => onFileChange(reader.result as string);
        reader.readAsDataURL(file);
      } else { toast.error("Unsupported file type. Please upload an image or PDF."); e.target.value = ""; }
    }
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2"><div className="flex items-center gap-2">{icon}<span>{label}</span></div></label>
      <div className="mt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 border-2 border-gray-300 rounded-lg bg-white">
        <input type="file" id={id} accept="image/*,application/pdf" onChange={handleFileSelect} className="hidden" disabled={isSubmitting}/>
        {fileData ? (
          <>
            <div className="flex items-center gap-3 flex-grow">
              <FileText className="h-8 w-8 text-indigo-500 flex-shrink-0" />
              <div className="flex-grow text-sm text-gray-700">File uploaded.</div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" icon={<Eye size={14} />} onClick={onView} disabled={isSubmitting} className="min-h-[44px]">View</Button>
              <Button type="button" variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => onFileChange(null)} className="text-red-500 min-h-[44px] min-w-[44px]" title="Remove File" disabled={isSubmitting}/>
            </div>
          </>
        ) : (
          <>
            <div className="flex-grow">
              <Button type="button" variant="outline" icon={<Upload size={16} />} onClick={() => document.getElementById(id)?.click()} disabled={isSubmitting} className="w-full min-h-[44px]">Upload File</Button>
            </div>
            <p className="text-xs text-gray-500 text-center sm:text-right">Max 5MB</p>
          </>
        )}
      </div>
    </div>
  );
};

const AddStaffPage: React.FC = () => {
  const router = useRouter();
  const { addStaffMember, positionOptions: contextPositionOptions = [], addPositionOption } = useStaff();
  const { data: session, status: sessionStatus } = useSession();

  const [formData, setFormData] = useState<StaffFormData>({
    staffIdNumber: "Loading...",
    name: "", email: "", phone: "", position: "",
    joinDate: new Date().toISOString().split("T")[0],
    salary: "", address: "", image: DEFAULT_STAFF_IMAGE, aadharNumber: "",
    aadharImage: null, passbookImage: null, agreementImage: null,
    password: "",
    isAvailableForBooking: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [positionOptions, setPositionOptions] = useState<PositionOption[]>(contextPositionOptions);
  const [showAddPositionForm, setShowAddPositionForm] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionError, setNewPositionError] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{ src: string | null; title: string; }>({ src: null, title: "" });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchNextId = async (tenantId: string) => {
      try {
        const response = await fetch("/api/staff?action=getNextId", {
          headers: { 'X-Tenant-ID': tenantId }, cache: 'no-store'
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to fetch Staff ID from server.");
        }
        const result = await response.json();
        if (result.success) {
          setFormData((prev) => ({ ...prev, staffIdNumber: result.data.nextId }));
        } else {
          throw new Error(result.error || "Could not retrieve next Staff ID.");
        }
      } catch (err: any) {
        setFormData((prev) => ({ ...prev, staffIdNumber: "Error" }));
        toast.error(`Could not load Staff ID: ${err.message}`);
      }
    };
    if (sessionStatus === 'authenticated') {
      const tenantId = session?.user?.tenantId;
      if (tenantId) { fetchNextId(tenantId); }
      else {
        setFormData((prev) => ({ ...prev, staffIdNumber: "Error" }));
        toast.error("Could not load Staff ID: Tenant ID is missing.");
      }
    } else if (sessionStatus === 'unauthenticated') {
        setFormData((prev) => ({ ...prev, staffIdNumber: "Error" }));
        toast.error("Could not load Staff ID: Not authenticated.");
    }
  }, [sessionStatus, session]);

  useEffect(() => {
    setPositionOptions(contextPositionOptions);
    if (!formData.position && contextPositionOptions.length > 0) {
      const firstSelectableOption = contextPositionOptions.find((opt) => opt.value !== "")?.value || contextPositionOptions[0]?.value;
      if (firstSelectableOption) {
        setFormData((prev) => ({ ...prev, position: firstSelectableOption }));
      }
    }
  }, [contextPositionOptions, formData.position]);

  // --- MODIFIED: Added real-time input validation ---
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData((prevData) => ({ ...prevData, [name]: checked }));
        return;
    }

    if (name === 'name') {
        // ✅ UPDATED: Allow alphabetic characters, spaces, AND periods
        if (/^[a-zA-Z\s.]*$/.test(value)) {
            setFormData((prevData) => ({ ...prevData, [name]: value }));
        }
    } else if (name === 'phone' || name === 'aadharNumber') {
        // Allow only numeric digits
        if (/^\d*$/.test(value)) {
            setFormData((prevData) => ({ ...prevData, [name]: value }));
        }
    } else {
        // For all other fields, update normally
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    }
  };

  const handleFileChange = (fieldName: keyof StaffFormData, fileData: string | null) => {
    setFormData((prev) => ({ ...prev, [fieldName]: fileData }));
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) { toast.error("Image size should not exceed 2MB."); e.target.value = ""; return; }
      try {
        const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
        setFormData((prev) => ({ ...prev, image: compressedDataUrl }));
      } catch (error) { toast.error("Failed to process profile image."); setFormData((prev) => ({ ...prev, image: DEFAULT_STAFF_IMAGE })); }
    }
  };

  const handleAddNewPosition = () => {
    setNewPositionError(null);
    if (!newPositionName.trim()) { setNewPositionError("Position name cannot be empty."); return; }
    const formattedNewPosition = newPositionName.trim();
    if (positionOptions.some((option) => option.value.toLowerCase() === formattedNewPosition.toLowerCase())) { setNewPositionError("This position already exists."); return; }
    const newOption = { value: formattedNewPosition, label: formattedNewPosition };
    addPositionOption(newOption);
    setFormData((prevData) => ({ ...prevData, position: newOption.value }));
    setNewPositionName(""); setShowAddPositionForm(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (formData.staffIdNumber === "Loading..." || formData.staffIdNumber === "Error") { toast.error("Staff ID is not available. Please refresh."); setIsSubmitting(false); return; }
    if (!formData.name.trim() || !formData.phone.trim() || !formData.position.trim() || !formData.aadharNumber.trim()) { toast.warn("Please fill in Name, Phone, Aadhar Number, and Position."); setIsSubmitting(false); return; }
    
    if (!formData.password || formData.password.length < 6) {
        toast.error("Password is required and must be at least 6 characters.");
        setIsSubmitting(false);
        return;
    }

    if (!/^\d{12}$/.test(formData.aadharNumber.trim())) { toast.error("Aadhar Number must be 12 digits."); setIsSubmitting(false); return; }
    if (formData.salary !== "" && Number(formData.salary) < 0) { toast.error("Salary cannot be negative."); setIsSubmitting(false); return; }

    const apiData: NewStaffPayload = {
      staffIdNumber: formData.staffIdNumber, name: formData.name, email: formData.email || "",
      phone: formData.phone, position: formData.position, joinDate: formData.joinDate,
      salary: Number(formData.salary) || 0, address: formData.address || "",
      image: formData.image === DEFAULT_STAFF_IMAGE ? null : formData.image, aadharNumber: formData.aadharNumber,
      aadharImage: formData.aadharImage, passbookImage: formData.passbookImage, agreementImage: formData.agreementImage,
      password: formData.password,
      isAvailableForBooking: formData.isAvailableForBooking,
    };

    try {
      await addStaffMember(apiData);
      router.push("/staffmanagement/staff/stafflist?success=add");
    } catch (apiError: any) {
      toast.error(apiError.message || "Failed to add staff member.");
      setIsSubmitting(false);
    }
  };

  const IconLabel: React.FC<{ htmlFor: string; icon: React.ReactNode; text: string; }> = ({ htmlFor, icon, text }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-2"><div className="flex items-center gap-2">{icon}<span>{text}</span></div></label>
  );

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light"/>
      <DocumentViewerModal src={viewingDocument.src} title={viewingDocument.title} onClose={() => setViewingDocument({ src: null, title: "" })}/>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => router.back()} className="mr-4" disabled={isSubmitting}>Back</Button>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Add New Staff Member</h1>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div className="md:col-span-2 mb-4">
            <IconLabel htmlFor="image-upload-input" icon={<ImageIcon size={14} className="text-gray-500" />} text="Profile Photo"/>
            <div className="flex items-center mt-1">
              <div className="flex-shrink-0 h-24 w-24 overflow-hidden rounded-full border-2 border-gray-300 bg-gray-100">
                <img src={formData.image || DEFAULT_STAFF_IMAGE} alt="Staff Preview" className="h-full w-full object-cover"/>
              </div>
              <div className="ml-5">
                <input type="file" id="image-upload-input" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} className="hidden" disabled={isSubmitting}/>
                <Button type="button" variant="outline" icon={<Upload size={16} />} onClick={() => document.getElementById("image-upload-input")?.click()} disabled={isSubmitting}>Upload Photo</Button>
                <Button type="button" variant="ghost" onClick={() => setFormData((prev) => ({ ...prev, image: DEFAULT_STAFF_IMAGE }))} disabled={isSubmitting || formData.image === DEFAULT_STAFF_IMAGE} className="ml-2 text-xs text-gray-500 hover:text-red-500 p-1" title="Reset to Default Photo">Reset</Button>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP up to 2MB.</p>
              </div>
            </div>
          </div>
          
          <div>
            <IconLabel htmlFor="staffIdNumber" icon={<Badge size={14} className="text-gray-500" />} text="Staff ID*"/>
            <input id="staffIdNumber" name="staffIdNumber" type="text" required value={formData.staffIdNumber} className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black bg-gray-100 cursor-not-allowed" readOnly/>
          </div>
          <div>
            <IconLabel htmlFor="name" icon={<User size={14} className="text-gray-500" />} text="Full Name*"/>
            {/* --- MODIFIED: Added maxLength --- */}
            <input id="name" name="name" type="text" required maxLength={50} value={formData.name} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100" disabled={isSubmitting}/>
          </div>
          <div>
            <IconLabel htmlFor="email" icon={<Mail size={14} className="text-gray-500" />} text="Email Address"/>
            <input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100" disabled={isSubmitting}/>
          </div>
          <div>
            <IconLabel htmlFor="phone" icon={<Phone size={14} className="text-gray-500" />} text="Phone Number*"/>
            {/* --- MODIFIED: Added maxLength --- */}
            <input id="phone" name="phone" type="tel" required maxLength={10} value={formData.phone} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100" disabled={isSubmitting}/>
          </div>
          <div>
            <IconLabel htmlFor="aadharNumber" icon={<Fingerprint size={14} className="text-gray-500" />} text="Aadhar Number*"/>
            <input id="aadharNumber" name="aadharNumber" type="text" required pattern="\d{12}" title="Aadhar number must be 12 digits" maxLength={12} value={formData.aadharNumber} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100" disabled={isSubmitting}/>
          </div>

          <div>
            <IconLabel htmlFor="password" icon={<ShieldCheck size={14} className="text-gray-500" />} text="Password*"/>
            <div className="relative">
              <input 
                id="password" 
                name="password" 
                type={showPassword ? "text" : "password"}
                required 
                minLength={6}
                maxLength={15}
                value={formData.password} 
                onChange={handleInputChange} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100 pr-10"
                disabled={isSubmitting}
                placeholder="Min. 6 characters,Max. 15 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <IconLabel htmlFor="position" icon={<Briefcase size={14} className="text-gray-500" />} text="Position*"/>
            <div className="flex items-center space-x-2">
              <select id="position" name="position" required value={formData.position} onChange={handleInputChange} className="flex-grow w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100" disabled={isSubmitting || showAddPositionForm}>
                {positionOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
              </select>
              {!showAddPositionForm && (<Button type="button" variant="ghost" icon={<PlusCircle size={20} />} onClick={() => setShowAddPositionForm(true)} disabled={isSubmitting} title="Add New Position" className="p-2 text-gray-600 hover:text-black"/>)}
            </div>
            {showAddPositionForm && (
              <div className="mt-2 p-3 border border-gray-200 rounded-md bg-gray-50">
                <label htmlFor="newPositionName" className="block text-xs font-medium text-gray-600 mb-1">New Position Name:</label>
                <div className="flex items-center space-x-2">
                  <input type="text" id="newPositionName" value={newPositionName} onChange={(e) => {setNewPositionName(e.target.value); if (newPositionError) setNewPositionError(null);}} placeholder="Enter position name" className="flex-grow w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black" disabled={isSubmitting}/>
                  <Button type="button" variant="primary" size="sm" onClick={handleAddNewPosition} disabled={isSubmitting || !newPositionName.trim()}>Add</Button>
                  <Button type="button" variant="ghost" onClick={() => {setShowAddPositionForm(false); setNewPositionName(""); setNewPositionError(null);}} disabled={isSubmitting} className="p-1.5 text-gray-500 hover:text-red-600" icon={<XCircle size={18} />} title="Cancel"/>
                </div>
                {newPositionError && <p className="text-xs text-red-600 mt-1">{newPositionError}</p>}
              </div>
            )}
          </div>
          <div>
            <IconLabel htmlFor="joinDate" icon={<Calendar size={14} className="text-gray-500" />} text="Join Date*"/>
            <input id="joinDate" name="joinDate" type="date" required value={formData.joinDate} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100" disabled={isSubmitting}/>
          </div>
          <div>
            <IconLabel htmlFor="salary" icon={<IndianRupee size={14} className="text-gray-500" />} text="Monthly Salary*"/>
            <input id="salary" name="salary" type="text" required min="0" value={formData.salary} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100" disabled={isSubmitting}/>
          </div>
          <div className="md:col-span-2">
            <IconLabel htmlFor="address" icon={<MapPin size={14} className="text-gray-500" />} text="Address"/>
            <textarea id="address" name="address" rows={3} value={formData.address} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:bg-gray-100" disabled={isSubmitting}></textarea>
          </div>
          
           <div className="md:col-span-2 border-t pt-5">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Settings</h3>
            <div className="relative flex items-start">
                <div className="flex h-6 items-center">
                    <input
                        id="isAvailableForBooking"
                        name="isAvailableForBooking"
                        type="checkbox"
                        checked={formData.isAvailableForBooking}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black disabled:opacity-50"
                        disabled={isSubmitting}
                    />
                </div>
                <div className="ml-3 text-sm leading-6">
                    <label htmlFor="isAvailableForBooking" className="font-medium text-gray-900">
                       Available for Booking
                    </label>
                    <p className="text-gray-500">
                        If checked, this staff member will appear as an option for new appointments.
                    </p>
                </div>
            </div>
          </div>
          
          <div className="md:col-span-2 border-t pt-4 sm:pt-5 mt-3 space-y-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FileUploadInput id="aadhar-upload" label="Aadhar Card" icon={<ShieldCheck size={16} className="text-gray-500" />} fileData={formData.aadharImage} onFileChange={(data) => handleFileChange("aadharImage", data)} onView={() => setViewingDocument({ src: formData.aadharImage, title: "Aadhar Card" })} isSubmitting={isSubmitting}/>
              <FileUploadInput id="passbook-upload" label="Bank Passbook" icon={<Banknote size={16} className="text-gray-500" />} fileData={formData.passbookImage} onFileChange={(data) => handleFileChange("passbookImage", data)} onView={() => setViewingDocument({ src: formData.passbookImage, title: "Bank Passbook" })} isSubmitting={isSubmitting}/>
              <FileUploadInput id="agreement-upload" label="Agreement" icon={<FileText size={16} className="text-gray-500" />} fileData={formData.agreementImage} onFileChange={(data) => handleFileChange("agreementImage", data)} onView={() => setViewingDocument({ src: formData.agreementImage, title: "Agreement" })} isSubmitting={isSubmitting}/>
            </div>
          </div>
        </div>
        
        {/* Fixed bottom save bar for mobile */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-10 md:relative md:bg-transparent md:border-t-0 md:p-0 md:mt-8">
          <div className="flex flex-col md:flex-row justify-end gap-3 md:gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()} 
              disabled={isSubmitting}
              className="w-full md:w-auto min-h-[48px] order-2 md:order-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="black" 
              icon={<Save size={16} />} 
              disabled={isSubmitting} 
              isLoading={isSubmitting}
              className="w-full md:w-auto min-h-[48px] bg-green-600 hover:bg-green-700 focus:ring-green-500 order-1 md:order-2"
            >
              {isSubmitting ? "Saving..." : "Save Staff Member"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddStaffPage;