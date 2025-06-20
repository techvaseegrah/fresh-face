'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { 
  ArrowUpTrayIcon, 
  XMarkIcon as XMarkOutlineIcon, // Renamed to avoid conflict
  SunIcon, 
  MoonIcon 
} from '@heroicons/react/24/outline';
import { 
  PhotoIcon, 
  XCircleIcon, 
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';

// --- Reusable Image Zoom Modal Component (Unchanged) ---
const ImageZoomModal = ({ src, onClose }: { src: string; onClose: () => void; }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <button 
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 p-2"
        onClick={onClose}
        aria-label="Close image zoom view"
      >
        <XMarkOutlineIcon className="h-8 w-8" />
      </button>
      <div 
        className="relative max-w-4xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={src} 
          alt="Zoomed meter image" 
          className="object-contain w-full h-full rounded-lg"
        />
      </div>
    </div>
  );
};

// --- Reusable Notification Toast Component ---
interface NotificationToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const NotificationToast = ({ message, type, onClose }: NotificationToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto-dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = type === 'success';
  const bgColor = isSuccess ? 'bg-green-50' : 'bg-red-50';
  const textColor = isSuccess ? 'text-green-800' : 'text-red-800';
  const iconColor = isSuccess ? 'text-green-400' : 'text-red-400';
  const Icon = isSuccess ? CheckCircleIcon : XCircleIcon;

  return (
    <div className="fixed top-5 right-5 z-[60] w-full max-w-sm animate-fade-in-down">
      <div className={`rounded-md ${bgColor} p-4 shadow-lg ring-1 ring-black ring-opacity-5`}>
        <div className="flex">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
          </div>
          <div className="ml-3">
            <p className={`text-sm font-medium ${textColor}`}>{message}</p>
          </div>
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex rounded-md p-1.5 ${bgColor} ${textColor} hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Reusable Image Dropzone Component ---
interface ImageDropzoneProps {
  preview: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  onZoom: () => void;
  disabled?: boolean;
}

const ImageDropzone = ({ preview, onFileSelect, onClear, onZoom, disabled = false }: ImageDropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };
  const handleDragOut = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled && e.target.files && e.target.files[0]) onFileSelect(e.target.files[0]);
  };

  return (
    <div className="md:col-span-2">
      <label className="text-sm font-medium text-gray-700">Meter Image</label>
      <div
        className={`mt-2 flex justify-center rounded-lg border-2 border-dashed px-6 pt-5 pb-6 transition-colors duration-200 ${
          isDragging ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}
      >
        {!preview ? (
          <div className="space-y-1 text-center">
            <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="flex text-sm text-gray-600">
              <label
                htmlFor="file-upload"
                className={`relative cursor-pointer rounded-md bg-white font-medium text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-indigo-500 ${disabled ? 'pointer-events-none text-gray-400' : ''}`}
              >
                <span>Upload a file</span>
                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" disabled={disabled} />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
          </div>
        ) : (
          <div className="relative group w-full max-w-md">
            <p className="text-center text-sm font-medium text-gray-700 mb-2">Image Selected. Click to zoom.</p>
            <img
              src={preview}
              alt="Meter image preview"
              className="rounded-lg object-cover w-full h-64 border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={!disabled ? onZoom : undefined}
            />
            <button
              type="button"
              onClick={!disabled ? onClear : undefined}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 text-gray-500 hover:text-red-600 transition-transform duration-200 transform group-hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Remove image"
              disabled={disabled}
            >
              <XCircleIcon className="h-8 w-8" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main EB Upload Page Component (Enhanced) ---
export default function EBUploadPage() {
  const { data: session } = useSession();
  const [type, setType] = useState<'morning' | 'evening'>('morning');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  const canUploadEB = session && hasPermission(session.user.role.permissions, PERMISSIONS.EB_UPLOAD);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);
  
  const handleClearForm = () => {
    setImage(null);
    setDate(new Date().toISOString().split('T')[0]);
    setType('morning');
  };

  if (!canUploadEB) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <p className="text-red-600">You do not have permission to upload EB readings.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !date) {
      setNotification({ show: true, message: 'Please select a date and an image file.', type: 'error' });
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('type', type);
    formData.append('image', image);
    formData.append('date', date);

    try {
      const response = await fetch('/api/eb', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setNotification({ show: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} reading uploaded successfully!`, type: 'success' });
        handleClearForm();
      } else {
        const errorData = await response.json();
        setNotification({ show: true, message: errorData.message || 'An unknown error occurred.', type: 'error' });
      }
    } catch (error) {
      console.error('Error uploading EB reading:', error);
      setNotification({ show: true, message: 'Failed to upload reading. Please check your connection.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isZoomed && preview && (
        <ImageZoomModal src={preview} onClose={() => setIsZoomed(false)} />
      )}
      
      {notification.show && (
        <NotificationToast 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}

      <div className="p-6 bg-gray-50 min-h-screen space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">EB Reading Upload</h1>
            <p className="text-gray-600 mt-1">Upload morning or evening meter images</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200/80 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:cursor-not-allowed disabled:bg-gray-50"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Reading Type</label>
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setType('morning')}
                  disabled={isLoading}
                  className={`flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                    type === 'morning' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <SunIcon className="h-5 w-5 mr-2"/>
                  Morning
                </button>
                <button
                  type="button"
                  onClick={() => setType('evening')}
                  disabled={isLoading}
                  className={`flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                    type === 'evening' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <MoonIcon className="h-5 w-5 mr-2"/>
                  Evening
                </button>
              </div>
            </div>

            <ImageDropzone 
              preview={preview}
              onFileSelect={(file) => setImage(file)}
              onClear={() => setImage(null)}
              onZoom={() => setIsZoomed(true)}
              disabled={isLoading}
            />

            <div className="md:col-span-2 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isLoading || !image}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-indigo-400 transition-all"
              >
                <ArrowUpTrayIcon className={`h-5 w-5 mr-3 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Uploading...' : 'Upload Image'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}