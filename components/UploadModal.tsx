
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, User, Image as ImageIcon, Info, AlertCircle, Trash2, CheckCircle, Video, Loader2 } from 'lucide-react';
import { EventConfig } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventConfig;
  onUpload: (files: File[], authorName: string) => void;
  deviceId?: string; // ID único para validar límites
}

interface FilePreviewItemProps {
  file: File;
  onRemove: () => void;
}

const FilePreviewItem: React.FC<FilePreviewItemProps> = ({ file, onRemove }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isVideo = file.type.startsWith('video/') || file.type === 'video/quicktime';
  const isImage = file.type.startsWith('image/');

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-100 text-sm hover:bg-gray-100 transition-colors group">
      <div className="flex items-center gap-3 truncate flex-1">
        {/* Thumbnail */}
        <div className="w-12 h-12 shrink-0 bg-gray-200 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center relative">
           {previewUrl && isVideo ? (
              <>
                <video 
                   src={previewUrl} 
                   className="w-full h-full object-cover opacity-90"
                   muted
                   playsInline
                   onLoadedMetadata={(e) => {
                     e.currentTarget.currentTime = 0.1; // Seek to capture a frame
                   }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                   <Video size={16} className="text-white drop-shadow-md" />
                </div>
              </>
           ) : previewUrl && isImage ? (
              <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
           ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                  {isVideo ? <Video size={20} /> : <ImageIcon size={20} />}
              </div>
           )}
        </div>
        
        {/* File Info */}
        <div className="flex flex-col truncate">
            <span className="truncate text-gray-700 font-medium text-xs md:text-sm">{file.name}</span>
            <span className="text-gray-400 text-[10px]">
                {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
        </div>
      </div>
      
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, event, onUpload, deviceId }) => {
  const [authorName, setAuthorName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Upload & Success States
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate previously uploaded items by this device
  // This ensures strict limits even if page is refreshed
  const previousUserPhotos = deviceId 
      ? event.photos.filter(p => p.deviceId === deviceId && p.type !== 'video').length 
      : 0;
  const previousUserVideos = deviceId
      ? event.photos.filter(p => p.deviceId === deviceId && p.type === 'video').length
      : 0;

  // Theme defaults
  const theme = event.theme || {
    primaryColor: '#a87b51',
    primaryTextColor: '#ffffff',
    secondaryColor: '#4f46e5',
    secondaryTextColor: '#ffffff'
  };

  // Helper for hex opacity
  const hexToRgba = (hex: string, alpha: number) => {
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      c = hex.substring(1).split('');
      if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c = '0x' + c.join('');
      return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
  };

  if (!isOpen) return null;

  const MAX_SIZE_MB = event.storageLimit || 10; 
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
  
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const ALLOWED_VIDEO_TYPES = [
      'video/mp4', 
      'video/webm', 
      'video/quicktime',
      'video/x-m4v',
      'video/3gpp'
  ];
  
  const getAcceptString = () => {
      let types: string[] = [];
      if (event.allowedMediaTypes.includes('photo')) types = [...types, ...ALLOWED_IMAGE_TYPES];
      if (event.allowedMediaTypes.includes('video')) types = [...types, ...ALLOWED_VIDEO_TYPES];
      return types.join(',');
  };

  const validateAndAddFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    
    setError(null);
    const newFiles: File[] = [];
    let invalidTypeCount = 0;
    let oversizedCount = 0;
    let duplicateCount = 0;
    let photoLimitReached = false;
    let videoLimitReached = false;

    // We start counting from what is currently selected in THIS session
    let currentSessionPhotoCount = selectedFiles.filter(f => f.type.startsWith('image/')).length;
    let currentSessionVideoCount = selectedFiles.filter(f => f.type.startsWith('video/') || f.type === 'video/quicktime').length;

    Array.from(fileList).forEach(file => {
      const isVideo = file.type.startsWith('video/') || file.type === 'video/quicktime';
      const isPhoto = file.type.startsWith('image/');
      
      let isAllowedType = false;
      if (isPhoto && event.allowedMediaTypes.includes('photo')) {
          isAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type);
      } else if (isVideo && event.allowedMediaTypes.includes('video')) {
          isAllowedType = ALLOWED_VIDEO_TYPES.includes(file.type);
      }

      if (!isAllowedType) {
        invalidTypeCount++;
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        oversizedCount++;
        return;
      }

      const isDuplicate = selectedFiles.some(f => f.name === file.name && f.size === file.size) || 
                          newFiles.some(f => f.name === file.name && f.size === file.size);
      if (isDuplicate) {
        duplicateCount++;
        return;
      }

      if (isPhoto) {
        // CHECK LIMIT: Previous Uploads + Current Session Uploads < Max
        if ((previousUserPhotos + currentSessionPhotoCount) < event.maxPhotosPerPerson) {
          newFiles.push(file);
          currentSessionPhotoCount++;
        } else {
          photoLimitReached = true;
        }
      } else if (isVideo) {
        // CHECK LIMIT: Previous Uploads + Current Session Uploads < Max
        if ((previousUserVideos + currentSessionVideoCount) < event.maxVideosPerPerson) {
          newFiles.push(file);
          currentSessionVideoCount++;
        } else {
          videoLimitReached = true;
        }
      }
    });

    if (oversizedCount > 0) {
      setError(`Se ignoraron ${oversizedCount} archivo(s) porque exceden el límite de ${MAX_SIZE_MB}MB.`);
    } else if (invalidTypeCount > 0) {
      setError(`Se ignoraron ${invalidTypeCount} archivo(s). Asegúrate de subir formatos válidos.`);
    } else if (photoLimitReached) {
      setError(`Límite de fotos alcanzado (${event.maxPhotosPerPerson}). Ya has subido ${previousUserPhotos} anteriormente.`);
    } else if (videoLimitReached) {
      setError(`Límite de videos alcanzado (${event.maxVideosPerPerson}). Ya has subido ${previousUserVideos} anteriormente.`);
    }

    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAddFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndAddFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (isUploading) return;
    setAuthorName('');
    setSelectedFiles([]);
    setError(null);
    setIsSuccess(false);
    setIsUploading(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!authorName.trim()) {
      setError("Por favor ingresa tu nombre para identificar las fotos.");
      return;
    }
    if (selectedFiles.length === 0) {
      setError("Por favor selecciona al menos una foto.");
      return;
    }

    setIsUploading(true);
    
    try {
        // We simulate a tiny pause just to let the UI render the loading state
        // then await the actual processing in App.tsx via onUpload
        await new Promise(resolve => setTimeout(resolve, 100)); 
        
        await onUpload(selectedFiles, authorName);
        
        setIsUploading(false);
        setIsSuccess(true);

        setTimeout(() => {
            handleClose();
        }, 3000);
    } catch (err) {
        console.error(err);
        setError("Hubo un error al procesar las imágenes. Inténtalo de nuevo.");
        setIsUploading(false);
    }
  };

  const acceptedStr = [
      event.allowedMediaTypes.includes('photo') ? 'Imágenes' : '',
      event.allowedMediaTypes.includes('video') ? 'Videos' : ''
  ].filter(Boolean).join(' y ');

  // Display counts: Total (Previous + Current) / Max
  const currentSessionPhotos = selectedFiles.filter(f => f.type.startsWith('image/')).length;
  const currentSessionVideos = selectedFiles.filter(f => f.type.startsWith('video/') || f.type === 'video/quicktime').length;
  
  const totalPhotos = previousUserPhotos + currentSessionPhotos;
  const totalVideos = previousUserVideos + currentSessionVideos;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={!isUploading && !isSuccess ? handleClose : undefined}
      />

      <div className="relative bg-white w-full max-w-4xl rounded-lg shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col min-h-[400px]">
        
        {isSuccess ? (
            <div className="flex flex-col items-center justify-center flex-1 p-10 text-center animate-fade-in">
                <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-sm animate-bounce">
                    <CheckCircle size={48} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">¡Archivos subidos con éxito!</h3>
                <p className="text-gray-500 text-lg mb-4">Gracias por compartir tus momentos, {authorName}.</p>
                
                <p className="text-sm text-gray-400">Cerrando ventana...</p>
            </div>
        ) : isUploading ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-center animate-fade-in">
                <div className="mb-8 relative">
                    <Loader2 size={64} className="text-gray-200 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Upload size={24} style={{ color: theme.primaryColor }} />
                    </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 mb-2">Procesando archivos...</h3>
                <p className="text-gray-500 mb-8">Estamos guardando tus recuerdos en la nube.</p>
                
                <p className="text-xs text-gray-400 mt-3">
                    Por favor no cierres esta ventana...
                </p>
            </div>
        ) : (
            <>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-center shrink-0 relative">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <CameraIcon className="text-gray-800" size={20} />
                        Subir Contenido al Evento
                    </h2>
                    <button 
                        onClick={handleClose}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-full">
                    
                    {/* Left Column: User Info */}
                    <div className="md:col-span-5 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <User size={16} />
                        Tu nombre *
                        </label>
                        <input 
                        type="text" 
                        value={authorName}
                        onChange={(e) => {
                            setAuthorName(e.target.value);
                            if(error?.includes('nombre')) setError(null);
                        }}
                        placeholder="Ej: María García"
                        className="w-full px-4 py-3 rounded-md border border-gray-300 focus:ring-2 outline-none transition-all text-gray-700 placeholder-gray-400"
                        style={{ 
                            '--tw-ring-color': hexToRgba(theme.primaryColor, 0.5),
                            '--tw-ring-opacity': 0.5
                        } as React.CSSProperties}
                        onFocus={(e) => {
                            e.target.style.borderColor = theme.primaryColor;
                            e.target.style.boxShadow = `0 0 0 3px ${hexToRgba(theme.primaryColor, 0.2)}`;
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#d1d5db';
                            e.target.style.boxShadow = 'none';
                        }}
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <Info size={12} />
                        <span>Tu nombre aparecerá en los archivos</span>
                        </div>
                    </div>

                    {/* Rules & Limits */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                         <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Límites de subida (Por Dispositivo)</h4>
                         <ul className="space-y-2 text-sm text-gray-600">
                             {event.allowedMediaTypes.includes('photo') && (
                                 <li className="flex justify-between items-center">
                                     <span>Fotos máx:</span>
                                     <div className="flex items-center gap-1">
                                         <span className={totalPhotos >= event.maxPhotosPerPerson ? "text-red-500 font-bold" : "font-medium"}>
                                             {totalPhotos} / {event.maxPhotosPerPerson}
                                         </span>
                                         {previousUserPhotos > 0 && <span className="text-[10px] text-gray-400">({previousUserPhotos} prev)</span>}
                                     </div>
                                 </li>
                             )}
                             {event.allowedMediaTypes.includes('video') && (
                                 <li className="flex justify-between items-center">
                                     <span>Videos máx:</span>
                                     <div className="flex items-center gap-1">
                                         <span className={totalVideos >= event.maxVideosPerPerson ? "text-red-500 font-bold" : "font-medium"}>
                                             {totalVideos} / {event.maxVideosPerPerson}
                                         </span>
                                         {previousUserVideos > 0 && <span className="text-[10px] text-gray-400">({previousUserVideos} prev)</span>}
                                     </div>
                                 </li>
                             )}
                             <li className="flex justify-between">
                                 <span>Tamaño máx:</span>
                                 <span>{MAX_SIZE_MB} MB/archivo</span>
                             </li>
                         </ul>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-md flex items-start gap-2 text-sm text-red-600 animate-pulse">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                        </div>
                    )}
                    </div>

                    {/* Right Column: Dropzone */}
                    <div className="md:col-span-7 flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <ImageIcon size={16} />
                        Seleccionar {acceptedStr}
                    </label>
                    
                    <div 
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center text-center p-6 cursor-pointer transition-all group`}
                        style={{
                            borderColor: isDragging ? theme.primaryColor : '#9ca3af',
                            backgroundColor: isDragging ? hexToRgba(theme.primaryColor, 0.1) : '#f9fafb',
                        }}
                    >
                        <input 
                            type="file" 
                            multiple 
                            accept={getAcceptString()}
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <div 
                            className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 ${isDragging ? 'scale-110 bg-white' : 'group-hover:scale-110'}`}
                            style={{ 
                                backgroundColor: isDragging ? '#ffffff' : hexToRgba(theme.primaryColor, 0.1)
                            }}
                        >
                            <Upload size={32} style={{ color: theme.primaryColor }} />
                        </div>
                        <h3 className="text-gray-700 font-medium mb-1">
                            {isDragging ? 'Suelta los archivos aquí' : 'Haz clic o arrastra tus archivos aquí'}
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            {acceptedStr} permitidos (Max {MAX_SIZE_MB}MB)
                        </p>
                    </div>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                        <div className="mt-4">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                            Archivos seleccionados ({selectedFiles.length})
                        </p>
                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                            {selectedFiles.map((file, index) => (
                                <FilePreviewItem 
                                    key={`${file.name}-${index}`} 
                                    file={file} 
                                    onRemove={() => removeFile(index)} 
                                />
                            ))}
                        </div>
                        </div>
                    )}
                    </div>

                </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button 
                    onClick={handleClose}
                    className="px-6 py-2.5 rounded-md bg-gray-500 text-white font-medium hover:bg-gray-600 transition-colors shadow-sm text-sm"
                >
                    Cancelar
                </button>
                <button 
                    onClick={handleSubmit}
                    disabled={selectedFiles.length === 0}
                    className="px-6 py-2.5 rounded-md font-medium transition-colors shadow-sm flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        backgroundColor: theme.primaryColor,
                        color: theme.primaryTextColor
                    }}
                >
                    <Upload size={16} />
                    Subir
                </button>
                </div>
            </>
        )}

      </div>
    </div>
  );
};

// Helper icon for the header
const CameraIcon = ({ className, size }: { className?: string, size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>
  </svg>
);