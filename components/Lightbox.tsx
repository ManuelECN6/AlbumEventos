
import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Flag, User, Clock, Download } from 'lucide-react';
import { Photo } from '../types';

interface LightboxProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  onLike: (id: string) => void;
  onReport: (id: string) => void;
  allPhotos?: Photo[];
  onSelect?: (index: number) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ 
  photo, 
  isOpen, 
  onClose, 
  onNext, 
  onPrev, 
  hasNext, 
  hasPrev,
  onLike,
  onReport,
  allPhotos = [],
  onSelect
}) => {
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset confirmation state when photo changes
  useEffect(() => {
    setShowReportConfirm(false);
    setIsDownloading(false);
  }, [photo?.id]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      // If confirmation modal is open, only allow Escape to close modal
      if (showReportConfirm) {
        if (e.key === 'Escape') setShowReportConfirm(false);
        return;
      }

      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasNext, hasPrev, onClose, onNext, onPrev, showReportConfirm]);

  if (!isOpen || !photo) return null;

  // Filter photos by same author, excluding current one, limit to 3
  const relatedPhotos = allPhotos
    .filter(p => p.author.name === photo.author.name && p.id !== photo.id)
    .slice(0, 3);

  // Helper para validar fechas y evitar "Invalid Date"
  const getFormattedDate = (dateString: string) => {
      const date = new Date(dateString);
      return !isNaN(date.getTime()) ? date.toLocaleString() : dateString;
  };

  // Función de descarga robusta
  const handleDownload = async () => {
    if (!photo) return;
    setIsDownloading(true);
    
    try {
      // Intentamos descargar el blob para forzar "Guardar como"
      const response = await fetch(photo.url, { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Nombre de archivo limpio
      const ext = photo.type === 'video' ? 'mp4' : 'jpg';
      const cleanTitle = (photo.title || 'recuerdo').replace(/[^a-z0-9]/gi, '_');
      link.download = `${cleanTitle}.${ext}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Download via blob failed (likely CORS), falling back to new tab", error);
      // Fallback: Abrir en nueva pestaña si falla el fetch (CORS o error de red)
      window.open(photo.url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fade-in overflow-y-auto select-none">
      
      {/* Close Button (Outside) */}
      <button 
        onClick={onClose} 
        className="fixed top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors z-[60]"
      >
        <X size={24} />
      </button>

      {/* Navigation Buttons (Outside) */}
      {hasPrev && (
        <button 
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="fixed left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all z-40 hidden md:flex"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      
      {hasNext && (
        <button 
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="fixed right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all z-40 hidden md:flex"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Main Content Card */}
      <div className="bg-white w-full max-w-[800px] rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[95vh] relative">
        
        {/* Report Confirmation Overlay */}
        {showReportConfirm && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white/90 backdrop-blur-sm p-6 animate-fade-in">
            <div className="max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Flag size={32} className="fill-current" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">¿Reportar esta foto?</h3>
              <p className="text-gray-500 text-sm mb-6">
                Si consideras que esta imagen es inapropiada u ofensiva, confirma para enviarla a revisión.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowReportConfirm(false)}
                  className="px-6 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    onReport(photo.id);
                    setShowReportConfirm(false);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors shadow-md"
                >
                  Sí, reportar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Area - Standard (Downloads Allowed) */}
        <div 
            className="flex-1 relative bg-black/5 flex items-center justify-center overflow-hidden min-h-[300px] group"
        >
           {photo.type === 'video' ? (
              <video 
                 src={photo.url} 
                 controls 
                 autoPlay 
                 className="max-h-[60vh] max-w-full object-contain shadow-sm"
              />
           ) : (
              <img 
                src={photo.url} 
                alt={photo.title || 'Foto del álbum'} 
                className="max-h-[60vh] w-auto object-contain shadow-sm"
              />
           )}
        </div>

        {/* Footer / Info Area */}
        <div className="bg-white px-6 py-5 flex flex-col gap-5 shrink-0 border-t border-gray-100 overflow-y-auto">
          
          <div className="flex flex-col items-center gap-5">
             {/* Metadata Section (Author & Date) */}
            <div className="flex flex-col items-center gap-2">
                {/* User Icon */}
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 mb-1">
                    <User size={24} />
                </div>
                
                {/* Name and Date */}
                <div className="text-center">
                    <p className="font-bold text-gray-800 text-2xl leading-tight">{photo.author.name}</p>
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-500 mt-2">
                        <Clock size={14} />
                        <span>{getFormattedDate(photo.createdAt)}</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-3 w-full">
              {/* Like Button */}
              <button 
                onClick={() => onLike(photo.id)}
                className={`flex items-center justify-center gap-2 px-6 py-2 rounded-md border font-medium transition-colors text-sm ${
                  photo.likedByMe 
                  ? 'bg-blue-50 border-blue-500 text-blue-600' 
                  : 'bg-white border-blue-400 text-blue-500 hover:bg-blue-50'
                }`}
              >
                <Heart size={16} className={photo.likedByMe ? "fill-current" : ""} />
                {photo.likedByMe ? "Te gusta" : "Me gusta"} ({photo.likes})
              </button>
              
              {/* Download Button (Enhanced) */}
              <button 
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 px-6 py-2 rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 font-medium transition-colors text-sm disabled:opacity-50"
              >
                <Download size={16} />
                {isDownloading ? 'Bajando...' : 'Descargar'}
              </button>
              
              {/* Report Button */}
              <button 
                onClick={() => setShowReportConfirm(true)}
                className="flex items-center justify-center gap-2 px-6 py-2 rounded-md border border-yellow-400 text-yellow-600 bg-white hover:bg-yellow-50 font-medium transition-colors text-sm"
              >
                <Flag size={16} />
                Reportar
              </button>
            </div>
          </div>

          {/* Related Photos (Author Carousel) */}
          {relatedPhotos.length > 0 && (
            <div className="w-full pt-4 border-t border-gray-100 mt-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">
                Últimas fotos de {photo.author.name}
              </p>
              <div className="flex justify-center gap-3">
                {relatedPhotos.map((p) => (
                  <button 
                    key={p.id} 
                    onClick={() => {
                        const index = allPhotos.findIndex(item => item.id === p.id);
                        if (index !== -1 && onSelect) onSelect(index);
                    }}
                    className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 hover:border-album-accent hover:shadow-md cursor-pointer transition-all group relative focus:outline-none focus:ring-2 focus:ring-album-accent"
                    title={p.title}
                  >
                    {p.type === 'video' ? (
                         <video src={p.thumbnail} className="w-full h-full object-cover opacity-90" muted />
                    ) : (
                        <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
