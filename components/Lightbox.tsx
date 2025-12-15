
import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Flag, User, Clock, Download, CheckCircle, ShieldAlert } from 'lucide-react';
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
  allowDownloads?: boolean; // Default to false
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
  onSelect,
  allowDownloads = false 
}) => {
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [isReported, setIsReported] = useState(false); // Estado para el contenido del MODAL
  const [reportSuccess, setReportSuccess] = useState(false); // Nuevo estado para el BOTÓN del footer
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset states when photo changes
  useEffect(() => {
    setShowReportConfirm(false);
    setIsReported(false);
    setReportSuccess(false);
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

  const handleReportAction = () => {
      onReport(photo.id);
      setIsReported(true); // Feedback en el modal
      setReportSuccess(true); // Feedback en el botón principal

      // Cerrar modal automáticamente después de 2 segundos
      setTimeout(() => {
          setShowReportConfirm(false);
          setIsReported(false);
      }, 2500);

      // Revertir el botón a su estado normal después de 4 segundos
      setTimeout(() => {
          setReportSuccess(false);
      }, 4000);
  };

  return (
    // ESTRUCTURA REFACTORIZADA CON SEMÁNTICA HTML5 + CLASES MV
    <section className="MV-visor-overlay fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto select-none bg-black/95 backdrop-blur-md animate-fade-in">
      
      {/* Navigation Buttons (Outside) - Mobile hide, Desktop show */}
      {hasPrev && (
        <button 
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="fixed left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all z-40 hidden md:flex MV-nav-btn prev"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      
      {hasNext && (
        <button 
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="fixed right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all z-40 hidden md:flex MV-nav-btn next"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Main Content Card */}
      <article className="MV-visor-card w-full max-w-[800px] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[95vh] relative">
        
        {/* BOTÓN CERRAR - AHORA DENTRO DE LA TARJETA PARA MEJOR VISIBILIDAD MÓVIL */}
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 z-[60] p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm transition-all shadow-sm"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Report Confirmation Overlay */}
        {showReportConfirm && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white/95 backdrop-blur-sm p-6 animate-fade-in MV-confirmacion-overlay">
            <div className="w-full max-w-sm text-center">
              
              {isReported ? (
                  // --- VISTA DE ÉXITO ---
                  <div className="animate-fade-in-up flex flex-col items-center">
                      <div className="flex items-center justify-center w-20 h-20 mx-auto mb-4 text-green-500 bg-green-100 rounded-full animate-bounce">
                        <CheckCircle size={40} className="fill-current" strokeWidth={3} />
                      </div>
                      <h3 className="mb-2 text-xl font-bold text-gray-800">¡Reporte Recibido!</h3>
                      <p className="mb-6 text-sm text-gray-500">
                        Gracias por ayudarnos. Un administrador revisará esta foto pronto.
                      </p>
                  </div>
              ) : (
                  // --- VISTA DE CONFIRMACIÓN ---
                  <>
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 text-red-500 bg-red-100 rounded-full">
                        <ShieldAlert size={32} className="fill-current" />
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-gray-800">¿Reportar esta foto?</h3>
                    <p className="mb-6 text-sm text-gray-500">
                        Si consideras que esta imagen es inapropiada u ofensiva, confirma para enviarla a revisión.
                    </p>
                    <div className="flex justify-center gap-3">
                        <button
                        onClick={() => setShowReportConfirm(false)}
                        className="px-6 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                        >
                        Cancelar
                        </button>
                        <button
                        onClick={handleReportAction}
                        className="px-6 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors shadow-md flex items-center gap-2"
                        >
                        <Flag size={16} /> Sí, reportar
                        </button>
                    </div>
                  </>
              )}
            </div>
          </div>
        )}

        {/* Image Area */}
        <figure 
            className="MV-visor-media-container flex-1 relative bg-black/5 flex items-center justify-center overflow-hidden min-h-[300px] group m-0"
        >
           {photo.type === 'video' ? (
              <video 
                 src={photo.url}
                 controls 
                 playsInline
                 preload="metadata" 
                 className="max-h-[60vh] max-w-full object-contain shadow-sm bg-black"
              />
           ) : (
              <img 
                src={photo.url} 
                alt={photo.title || 'Foto del álbum'} 
                className="max-h-[60vh] w-auto object-contain shadow-sm"
              />
           )}
        </figure>

        {/* Footer / Info Area */}
        <footer className="flex flex-col flex-shrink-0 gap-5 px-6 py-5 overflow-y-auto bg-white border-t border-gray-100 MV-visor-info-panel">
          
          <div className="flex flex-col items-center gap-5">
             {/* Metadata Section (Author & Date) */}
            <div className="flex flex-col items-center gap-2 MV-autor-info">
                {/* User Icon */}
                <div className="flex items-center justify-center w-12 h-12 mb-1 text-gray-500 bg-gray-100 rounded-full">
                    <User size={24} />
                </div>
                
                {/* Name and Date */}
                <div className="text-center">
                    <p className="text-2xl font-bold leading-tight text-gray-800">{photo.author.name}</p>
                    <div className="flex items-center justify-center gap-2 mt-2 text-sm font-medium text-gray-500">
                        <Clock size={14} />
                        <span>{getFormattedDate(photo.createdAt)}</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center w-full gap-3 MV-acciones">
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
              
              {/* Download Button (Enhanced) - CONDITIONAL RENDERING */}
              {allowDownloads && (
                  <button 
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-gray-600 transition-colors bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Download size={16} />
                    {isDownloading ? 'Bajando...' : 'Descargar'}
                  </button>
              )}
              
              {/* Report Button (Updated with visual feedback) */}
              <button 
                onClick={() => !reportSuccess && setShowReportConfirm(true)}
                disabled={reportSuccess}
                className={`flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium transition-all duration-300 border rounded-md ${
                    reportSuccess
                    ? 'bg-green-50 border-green-500 text-green-600 cursor-default'
                    : 'text-yellow-600 bg-white border-yellow-400 hover:bg-yellow-50'
                }`}
              >
                {reportSuccess ? <CheckCircle size={16} /> : <Flag size={16} />}
                {reportSuccess ? 'Reportado' : 'Reportar'}
              </button>
            </div>
          </div>

          {/* Related Photos (Author Carousel) */}
          {relatedPhotos.length > 0 && (
            <div className="w-full pt-4 mt-2 border-t border-gray-100 MV-relacionados">
              <p className="mb-3 text-xs font-bold text-center text-gray-400 uppercase tracking-wider">
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
                    className="relative flex-shrink-0 w-20 h-20 overflow-hidden transition-all border border-gray-200 rounded-lg cursor-pointer hover:border-album-accent hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-album-accent"
                    title={p.title}
                  >
                    {p.type === 'video' ? (
                         <video src={p.thumbnail} className="object-cover w-full h-full opacity-90" muted />
                    ) : (
                        <img src={p.thumbnail} alt={p.title} className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110" />
                    )}
                    <div className="absolute inset-0 transition-colors bg-black/0 group-hover:bg-black/10" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </footer>
      </article>
    </section>
  );
};
