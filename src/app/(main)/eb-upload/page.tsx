'use client';

import { useState, useMemo, useCallback, useEffect, FC, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { 
  ArrowUpTrayIcon, 
  XMarkIcon as XMarkOutlineIcon,
  DocumentIcon,
  CalendarDaysIcon,
  PhotoIcon,
  XCircleIcon,
  CheckCircleIcon,
  XMarkIcon as XMarkSolidIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';
import Image from 'next/image';

// --- UTILITY & REUSABLE COMPONENTS ---

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const ImageZoomModal: FC<{ src: string; onClose: () => void; }> = ({ src, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4 transition-opacity duration-300" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 p-2" onClick={onClose} aria-label="Close image zoom view">
        <XMarkOutlineIcon className="h-8 w-8" />
      </button>
      <div className="relative w-full h-full max-w-4xl max-h-[90vh] transition-transform duration-300 scale-95 animate-zoom-in" onClick={(e) => e.stopPropagation()}>
        <Image src={src} alt="Zoomed meter image" layout="fill" className="object-contain rounded-lg" />
      </div>
    </div>
  );
};

const NotificationToast: FC<{ message: string; type: 'success' | 'error'; onClose: () => void; }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = type === 'success';
  return (
    <div className="fixed top-5 right-5 z-[60] w-full max-w-sm animate-fade-in-down">
      <div className={`rounded-lg ${isSuccess ? 'bg-green-50' : 'bg-red-50'} p-4 shadow-lg ring-1 ring-black ring-opacity-5`}>
        <div className="flex">
          <div className="flex-shrink-0">
            {isSuccess ? <CheckCircleIcon className="h-5 w-5 text-green-400" /> : <XCircleIcon className="h-5 w-5 text-red-400" />}
          </div>
          <div className="ml-3">
            <p className={`text-sm font-medium ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>{message}</p>
          </div>
          <div className="ml-auto pl-3">
            <button type="button" onClick={onClose} className={`inline-flex rounded-md p-1.5 ${isSuccess ? 'text-green-500 hover:bg-green-100' : 'text-red-500 hover:bg-red-100'}`}>
              <span className="sr-only">Dismiss</span><XMarkSolidIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ImageDropzone: FC<{ file: File | null; onFileSelect: (file: File) => void; onClear: () => void; onZoom: () => void; disabled?: boolean; }> = ({ file, onFileSelect, onClear, onZoom, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const preview = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);

  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items?.length > 0) setIsDragging(true); }, []);
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (!disabled && e.dataTransfer.files?.length > 0) { onFileSelect(e.dataTransfer.files[0]); e.dataTransfer.clearData(); }
  }, [disabled, onFileSelect]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (!disabled && e.target.files?.[0]) onFileSelect(e.target.files[0]); };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="flex flex-col h-full">
      <label htmlFor="file-upload" className={`relative flex flex-col items-center justify-center w-full h-full rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors duration-300 ${disabled ? 'bg-slate-200/50 cursor-not-allowed' : 'bg-slate-100 hover:border-indigo-400'} ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'}`} onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}>
        {!file || !preview ? (
          <div className="space-y-2">
            <PhotoIcon className="mx-auto h-16 w-16 text-slate-400" />
            <p className="font-semibold text-slate-700"><span className="text-indigo-600">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-slate-500">PNG, JPG, or GIF (max 10MB)</p>
          </div>
        ) : (
          <div className="relative w-full text-left">
            <div className="overflow-hidden rounded-xl shadow-lg bg-white cursor-zoom-in" onClick={!disabled ? (e) => { e.preventDefault(); e.stopPropagation(); onZoom(); } : undefined}>
                <Image src={preview} alt="Meter image preview" width={500} height={400} className="w-full h-64 object-cover" />
                <div className="p-4 border-t border-slate-200">
                  <div className="flex items-start">
                    <DocumentIcon className="h-10 w-10 text-slate-400 flex-shrink-0 mr-3 mt-1"/>
                    <div>
                        <p className="text-sm font-medium text-slate-800 break-all">{file.name}</p>
                        <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                    </div>
                  </div>
                </div>
            </div>
             <button type="button" onClick={!disabled ? (e) => { e.preventDefault(); e.stopPropagation(); onClear(); } : undefined} className="absolute -top-3 -right-3 bg-white rounded-full p-1 text-slate-500 hover:text-red-600 shadow-md transition-transform duration-200 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Remove image" disabled={disabled}>
              <XCircleIcon className="h-8 w-8" />
            </button>
          </div>
        )}
        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" disabled={disabled} />
      </label>
    </div>
  );
};

type EBMeter = {
  identifier: string;
  name: string;
};

const EditMeterModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
  meter: EBMeter | null;
  isSaving: boolean;
}> = ({ isOpen, onClose, onSave, meter, isSaving }) => {
  const [name, setName] = useState('');
  useEffect(() => { if (meter) setName(meter.name); }, [meter]);
  if (!isOpen || !meter) return null;
  const handleSave = () => { if (name.trim().length >= 3) onSave(name.trim()); };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">Edit Meter Name</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
        </div>
        <div>
          <label htmlFor="meter-name" className="block text-sm font-medium text-slate-700">Meter Name</label>
          <input type="text" id="meter-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" disabled={isSaving} />
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={isSaving || name.trim().length < 3} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};


// --- Main EB Upload Page Component ---
export default function EBUploadPage() {
  const { data: session } = useSession();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [meterIdentifier, setMeterIdentifier] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error'; }>({ show: false, message: '', type: 'success' });
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [meters, setMeters] = useState<EBMeter[]>([]);
  const [isMetersLoading, setIsMetersLoading] = useState(true);
  const [meterFetchError, setMeterFetchError] = useState<string | null>(null);
  const [isCreatingMeter, setIsCreatingMeter] = useState(false);
  const [newMeterName, setNewMeterName] = useState('');
  const [isSavingMeter, setIsSavingMeter] = useState(false);
  const [meterCreationError, setMeterCreationError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [meterToEdit, setMeterToEdit] = useState<EBMeter | null>(null);

  const canUploadEB = session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD);
  
  const fetchMeters = useCallback(async (options: { selectFirst?: boolean } = {}) => {
    if (!session?.user?.tenantId) { setIsMetersLoading(false); return; }
    setIsMetersLoading(true);
    setMeterFetchError(null);
    try {
      const headers = new Headers();
      headers.append('x-tenant-id', session.user.tenantId);
      const response = await fetch('/api/eb/meters', { headers, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch meters');
      const fetchedMeters = data.meters || [];
      setMeters(fetchedMeters);

      if (options.selectFirst && fetchedMeters.length > 0) {
        setMeterIdentifier(fetchedMeters[0].identifier);
      } else if (fetchedMeters.length === 0) {
        setMeterIdentifier('');
      }
    } catch (error) { setMeterFetchError('Could not load the list of meters.'); } 
    finally { setIsMetersLoading(false); }
  }, [session]);

  useEffect(() => { if (canUploadEB) fetchMeters({ selectFirst: true }); }, [canUploadEB, fetchMeters]);

  useEffect(() => {
    const tenantId = session?.user?.tenantId;
    if (!canUploadEB || !date || !meterIdentifier || !tenantId) { setIsChecking(false); return; }
    const controller = new AbortController();
    const checkForExistingReading = async () => {
      setIsChecking(true);
      try {
        const headers = new Headers(); headers.append('x-tenant-id', tenantId);
        const url = `/api/eb/check?date=${date}&meterIdentifier=${meterIdentifier}`;
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) throw new Error('API check failed');
        const data = await res.json();
        if (controller.signal.aborted) return;
        setIsUpdateMode(data.success && data.exists);
      } catch (error) { if (error instanceof Error && error.name !== 'AbortError') setIsUpdateMode(false); } 
      finally { if (!controller.signal.aborted) setIsChecking(false); }
    };
    const handler = setTimeout(() => checkForExistingReading(), 300);
    return () => { clearTimeout(handler); controller.abort(); };
  }, [date, meterIdentifier, session, canUploadEB]);

  const handleClearForm = () => {
    setImageFile(null);
    setDate(new Date().toISOString().split('T')[0]);
    if (meters.length > 0) setMeterIdentifier(meters[0].identifier);
  };

  const handleCreateMeter = async () => {
    if (!newMeterName.trim() || !session?.user?.tenantId) return;
    setIsSavingMeter(true);
    setMeterCreationError(null);
    try {
      const res = await fetch('/api/eb/meters', {
        method: 'POST',
        headers: { 'x-tenant-id': session.user.tenantId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMeterName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create meter.');
      
      const newMeter: EBMeter = data.meter;
      await fetchMeters();
      setMeterIdentifier(newMeter.identifier);
      setIsCreatingMeter(false);
      setNewMeterName('');
      setNotification({ show: true, message: `Meter "${newMeter.name}" created.`, type: 'success' });
    } catch (error) { setMeterCreationError((error as Error).message); } 
    finally { setIsSavingMeter(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.tenantId) { setNotification({ show: true, message: 'Tenant ID missing.', type: 'error' }); return; }
    if (!imageFile || !date || !meterIdentifier) { setNotification({ show: true, message: 'Please select a date, meter, and image.', type: 'error' }); return; }
    setIsLoading(true);
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('date', date);
    formData.append('meterIdentifier', meterIdentifier);
    try {
      const headers = new Headers(); headers.append('x-tenant-id', session.user.tenantId);
      const res = await fetch('/api/eb', { method: 'POST', headers, body: formData });
      if (res.ok) {
        const name = meters.find(m => m.identifier === meterIdentifier)?.name || 'meter';
        const msg = isUpdateMode ? `Reading for ${name} updated!` : `Reading for ${name} uploaded!`;
        setNotification({ show: true, message: msg, type: 'success' });
        handleClearForm();
      } else {
        const err = await res.json();
        setNotification({ show: true, message: err.message || 'Error occurred.', type: 'error' });
      }
    } catch (error) { setNotification({ show: true, message: 'Upload failed. Check connection.', type: 'error' }); } 
    finally { setIsLoading(false); }
  };
  
  const handleOpenEditModal = (meter: EBMeter) => { setMeterToEdit(meter); setIsEditModalOpen(true); };

  const handleUpdateMeterName = async (newName: string) => {
    if (!meterToEdit || !session?.user?.tenantId) return;
    setIsSavingMeter(true);
    try {
        const res = await fetch(`/api/eb/meters/${meterToEdit.identifier}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': session.user.tenantId },
            body: JSON.stringify({ name: newName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        
        setNotification({ show: true, message: `Meter renamed to "${newName}".`, type: 'success' });
        await fetchMeters();
        setIsEditModalOpen(false);
    } catch (error) { alert(`Error: ${(error as Error).message}`); } 
    finally { setIsSavingMeter(false); }
  };

  const handleDeleteMeter = async (meterToDelete: EBMeter) => {
    if (!session?.user?.tenantId || !window.confirm(`Are you sure you want to delete "${meterToDelete.name}"? This cannot be undone.`)) return;
    try {
        const res = await fetch(`/api/eb/meters/${meterToDelete.identifier}`, {
            method: 'DELETE',
            headers: { 'x-tenant-id': session.user.tenantId },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        
        setNotification({ show: true, message: `Meter "${meterToDelete.name}" deleted.`, type: 'success' });
        await fetchMeters({ selectFirst: true });
    } catch (error) { alert(`Error: ${(error as Error).message}`); }
  };
  
  const isFormDisabled = isLoading || isChecking || isMetersLoading || isSavingMeter;

  if (!session) return <div className="p-6 bg-slate-100 min-h-screen">Loading...</div>;
  if (!canUploadEB) return <div className="p-6 bg-slate-100 min-h-screen"><p className="text-red-600">You do not have permission to manage EB meters.</p></div>;

  return (
    <>
      <EditMeterModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={handleUpdateMeterName} meter={meterToEdit} isSaving={isSavingMeter} />
      {isZoomed && imageFile && <ImageZoomModal src={URL.createObjectURL(imageFile)} onClose={() => setIsZoomed(false)} />}
      {notification.show && <NotificationToast message={notification.message} type={notification.type} onClose={() => setNotification({ ...notification, show: false })} />}

      <main className="bg-slate-100 p-4 sm:p-6 lg:p-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">{isUpdateMode ? 'Update Morning Reading' : 'Upload Morning Reading'}</h1>
                <p className="text-slate-500 mt-1">{isChecking ? 'Checking for existing readings...' : isUpdateMode ? 'A reading for this date and meter exists. Uploading will replace the old image.' : 'Upload the meter image for the selected date.'}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200/80">
                <form onSubmit={handleSubmit} className="lg:grid lg:grid-cols-5">
                    <div className="px-6 py-8 sm:p-10 lg:col-span-2">
                        <h2 className="text-xl font-semibold text-slate-800">Reading Details</h2>
                        <p className="text-sm text-slate-500 mt-1">Select, add, or manage your meters.</p>
                        <div className="mt-8 space-y-8">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Select Meter</label>
                                <fieldset>
                                    <legend className="sr-only">EB Meter selection</legend>
                                    <div className="space-y-2">
                                      {isMetersLoading && <p className="text-sm text-slate-500">Loading meters...</p>}
                                      {meterFetchError && <p className="text-sm text-red-600">{meterFetchError}</p>}
                                      {!isMetersLoading && !meterFetchError && meters.length === 0 && <p className="text-sm text-slate-500">No meters found. Add one to begin.</p>}
                                      {meters.map((meter) => (
                                        <div key={meter.identifier} className="group flex items-center justify-between">
                                          <div className="flex items-center">
                                            <input id={meter.identifier} name="meter-selection" type="radio" value={meter.identifier} checked={meterIdentifier === meter.identifier} onChange={() => setMeterIdentifier(meter.identifier)} disabled={isFormDisabled} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <label htmlFor={meter.identifier} className="ml-3 block text-sm text-gray-900">{meter.name}</label>
                                          </div>
                                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button type="button" onClick={() => handleOpenEditModal(meter)} title="Edit name" className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"><PencilSquareIcon className="h-4 w-4" /></button>
                                            <button type="button" onClick={() => handleDeleteMeter(meter)} title="Delete meter" className="p-1 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-4">
                                      {!isCreatingMeter ? (
                                        <button type="button" onClick={() => setIsCreatingMeter(true)} disabled={isFormDisabled} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 disabled:cursor-not-allowed">
                                          <PlusCircleIcon className="mr-2 h-5 w-5" />Add New Meter
                                        </button>
                                      ) : (
                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                                          <label htmlFor="new-meter-name" className="block text-sm font-medium text-slate-700">New Meter Name</label>
                                          <input type="text" id="new-meter-name" value={newMeterName} onChange={(e) => setNewMeterName(e.target.value)} placeholder="e.g., Workshop Meter" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required disabled={isSavingMeter} />
                                          {meterCreationError && <p className="text-xs text-red-600">{meterCreationError}</p>}
                                          <div className="flex items-center justify-end space-x-2">
                                            <button type="button" onClick={() => { setIsCreatingMeter(false); setMeterCreationError(null); }} disabled={isSavingMeter} className="px-3 py-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancel</button>
                                            <button type="button" onClick={handleCreateMeter} disabled={isSavingMeter || !newMeterName.trim()} className="inline-flex items-center justify-center px-3 py-1 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400">
                                              {isSavingMeter ? 'Saving...' : 'Save'}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                </fieldset>
                            </div>
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium text-slate-700">Date of Morning Reading</label>
                                <div className="relative mt-2">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><CalendarDaysIcon className="h-5 w-5 text-slate-400" /></div>
                                    <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-10 p-2.5 disabled:cursor-not-allowed disabled:bg-slate-50" disabled={isFormDisabled} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-12 pt-8 border-t border-slate-200">
                            <button type="submit" disabled={isFormDisabled || !imageFile || !meterIdentifier} className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-indigo-400">
                                <ArrowUpTrayIcon className={`-ml-1 mr-3 h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                                {isLoading ? 'Processing...' : (isUpdateMode ? 'Update Image' : 'Upload Image')}
                            </button>
                        </div>
                    </div>
                    <div className="lg:col-span-3 p-6 sm:p-10 bg-slate-50/70 lg:border-l lg:border-slate-200">
                        <ImageDropzone file={imageFile} onFileSelect={(file) => setImageFile(file)} onClear={() => setImageFile(null)} onZoom={() => setIsZoomed(true)} disabled={isFormDisabled} />
                    </div>
                </form>
            </div>
        </div>
      </main>
    </>
  );
}