'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function VideoPlayerModal({ src, onClose }: { src: string; onClose: () => void; }) {
  // Add an effect to handle the 'Escape' key to close the modal
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

  if (!src) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-[60] p-4"
      onClick={onClose} // Close modal when clicking the background
    >
      <div 
        className="bg-black rounded-lg shadow-xl w-full max-w-4xl relative"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the video itself
      >
        <button 
          onClick={onClose} 
          className="absolute -top-4 -right-4 text-white bg-gray-800 rounded-full p-2 hover:bg-red-600 transition-colors z-10"
          aria-label="Close video player"
        >
          <X size={24} />
        </button>
        <video
          src={src}
          className="w-full h-auto max-h-[85vh] rounded-lg"
          controls // Show native video controls (play, pause, volume, fullscreen)
          autoPlay // Start playing the video immediately
        />
      </div>
    </div>
  );
}