
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, User, Image as ImageIcon, Info, AlertCircle, Trash2, CheckCircle, Video, Loader2, Lock } from 'lucide-react';
import { EventConfig } from '../types';

// MOVED TO TOP TO PREVENT HOISTING ERRORS
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
  // 1. Determinar el ID efectivo
  const effectiveDeviceId = useMemo(() => {
      return deviceId || localStorage.getItem('album_device_id') || 'unknown-device';
  }, [deviceId]);

  // 2. Detectar si este usuario ya existe en el evento
  const existingUserInEvent = useMemo(() => {
      return event.photos?.find(p => p.deviceId === effectiveDeviceId);
  }, [event.photos, effectiveDeviceId]);

  // 3. Inicializar nombre: O el del evento, o el del localStorage, o vacío
  const [authorName, setAuthorName] = useState(() => {
      if (existingUserInEvent) return existingUserInEvent.author.name;
      return localStorage.getItem('album_user_name') || '';
  });

  // Efecto para actualizar el nombre si se abre el modal y ya existe un registro
  useEffect(() => {
      if (isOpen && existingUserInEvent) {
          setAuthorName(existingUserInEvent.author.name);
      } else if (isOpen && !authorName) {
          // Si es nuevo en este evento, intentar recuperar nombre global
          const globalName = localStorage.getItem('album_user_name');
          if (globalName) setAuthorName(globalName);
      }
  }, [isOpen, existingUserInEvent]);

  // 4. Bloquear el input si ya ha subido fotos antes (Seguridad de Identidad)
  const isNameLocked = !!existingUserInEvent;

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Upload & Success States
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 5. Calcular conteos previos estrictos por tipo
  const previousUserPhotos = useMemo(() => 
      (event.photos || []).filter(p => p.deviceId === effectiveDeviceId && p.type !== 'video').length
  , [event.photos, effectiveDeviceId]);

  const previousUserVideos = useMemo(() =>
      (event.photos || []).filter(p => p.deviceId === effectiveDeviceId && p.type === 'video').length
  , [event.photos, effectiveDeviceId]);

  // Theme defaults
  const theme = event.theme || {
    primaryColor: '#a87b51',
    primaryTextColor: '#ffffff',
    secondaryColor: '#4f46e5',
    secondaryTextColor: '#ffffff'
  };

  const hexToRgba = (hex: any, alpha: number) => {
    try {
        if (!hex || typeof hex !== 'string') return 'transparent';
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
    } catch (e) {
        return 'transparent';
    }
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
  
  const MAX_VIDEO_MB = event.maxVideoSizeMB || 50; 
  const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
  
  const getAcceptString = () => {
      let types: string[] = [];
      const allowed = event.allowedMediaTypes || ['photo'];
      if (allowed.includes('photo')) types = [...types, ...ALLOWED_IMAGE_TYPES];
      if (allowed.includes('video')) types = [...types, ...ALLOWED_VIDEO_TYPES];
      return types.join(',');
  };

  const validateAndAddFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    
    setError(null);
    const newFiles: File[] = [];
    
    // Contadores de errores
    let invalidTypeCount = 0;
    let oversizedCount = 0;
    let videoOversizedCount = 0;
    let duplicateCount = 0;
    let photosRejectedByLimit = 0;
    let videosRejectedByLimit = 0;
    let totalEventLimitExceeded = false;

    // Calcular uso actual del evento
    const currentEventUsage = event.totalUsageBytes || 0;
    const eventLimitBytes = (event.totalEventSizeLimitGB || 5) * 1024 * 1024 * 1024;

    // We start counting from what is currently selected in THIS session
    let currentSessionPhotoCount = selectedFiles.filter(f => f.type.startsWith('image/')).length;
    let currentSessionVideoCount = selectedFiles.filter(f => f.type.startsWith('video/') || f.type === 'video/quicktime').length;
    
    // Calcular tamaño acumulado de la sesión actual
    let currentSessionBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

    const allowed = event.allowedMediaTypes || ['photo'];

    Array.from(fileList).forEach(file => {
      if (totalEventLimitExceeded) return;

      const isVideo = file.type.startsWith('video/') || file.type === 'video/quicktime';
      const isPhoto = file.type.startsWith('image/');
      
      // 1. Check Global Event Size Limit
      if ((currentEventUsage + currentSessionBytes + file.size) > eventLimitBytes) {
          totalEventLimitExceeded = true;
          return;
      }

      // 2. Check Type
      let isAllowedType = false;
      if (isPhoto && allowed.includes('photo')) {
          isAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type);
      } else if (isVideo && allowed.includes('video')) {
          isAllowedType = ALLOWED_VIDEO_TYPES.includes(file.type);
      }

      if (!isAllowedType) {
        invalidTypeCount++;
        return;
      }

      // 3. Check Size Limits
      if (isVideo) {
          if (file.size > MAX_VIDEO_BYTES) {
              videoOversizedCount++;
              return;
          }
      } else {
          // General storage limit per file for photos
          if (file.size > MAX_SIZE_BYTES) {
            oversizedCount++;
            return;
          }
      }

      // 4. Check Duplicates
      const isDuplicate = selectedFiles.some(f => f.name === file.name && f.size === file.size) || 
                          newFiles.some(f => f.name === file.name && f.size === file.size);
      if (isDuplicate) {
        duplicateCount++;
        return;
      }

      // 5. Check Quantity Limits per Person
      if (isPhoto) {
        // CHECK LIMIT: Previous Uploads + Current Session Uploads < Max
        if ((previousUserPhotos + currentSessionPhotoCount) < event.maxPhotosPerPerson) {
          newFiles.push(file);
          currentSessionPhotoCount++;
          currentSessionBytes += file.size;
        } else {
          photosRejectedByLimit++;
        }
      } else if (isVideo) {
        // CHECK LIMIT: Previous Uploads + Current Session Uploads < Max
        if ((previousUserVideos + currentSessionVideoCount) < event.maxVideosPerPerson) {
          newFiles.push(file);
          currentSessionVideoCount++;
          currentSessionBytes += file.size;
        } else {
          videosRejectedByLimit++;
        }
      }
    });

    // Construcción de mensajes de error inteligentes
    let errorMessages: string[] = [];
    
    if (totalEventLimitExceeded) {
        errorMessages.push(`• El álbum ha alcanzado su límite total de almacenamiento (${event.totalEventSizeLimitGB}GB). No caben más archivos.`);
    }
    if (videoOversizedCount > 0) {
        errorMessages.push(`• ${videoOversizedCount} video(s) exceden el límite de ${MAX_VIDEO_MB}MB.`);
    }
    if (oversizedCount > 0) {
        errorMessages.push(`• ${oversizedCount} archivo(s) exceden el límite de ${MAX_SIZE_MB}MB.`);
    }
    if (invalidTypeCount > 0) {
        errorMessages.push(`• ${invalidTypeCount} archivo(s) tienen un formato no válido.`);
    }
    if (photosRejectedByLimit > 0) {
        errorMessages.push(`• Se omitieron ${photosRejectedByLimit} fotos por límite de usuario (${event.maxPhotosPerPerson}).`);
    }
    if (videosRejectedByLimit > 0) {
        errorMessages.push(`• Se omitieron ${videosRejectedByLimit} videos por límite de usuario (${event.maxVideosPerPerson}).`);
    }

    if (errorMessages.length > 0) {
        setError(errorMessages.join(' '));
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
    if (!existingUserInEvent) {
       setAuthorName(''); // Solo limpiar si no está registrado
    }
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

    // --- NUEVA VALIDACIÓN: CAPACIDAD DEL EVENTO (PERSONAS) ---
    const capacityLimit = event.participantsCount || 0;
    if (capacityLimit > 0 && !existingUserInEvent) {
         const currentOccupancy = event.participants?.length || 0;
         if (currentOccupancy >= capacityLimit) {
             setError("Lo sentimos, este álbum ha alcanzado el límite máximo de invitados permitidos.");
             return;
         }
    }
    
    // --- NUEVA VALIDACIÓN: CAPACIDAD DEL EVENTO (GB) FINAL CHECK ---
    const currentEventUsage = event.totalUsageBytes || 0;
    const eventLimitBytes = (event.totalEventSizeLimitGB || 5) * 1024 * 1024 * 1024;
    const uploadTotalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

    if (currentEventUsage + uploadTotalSize > eventLimitBytes) {
        setError(`No hay suficiente espacio libre en el álbum. Límite: ${event.totalEventSizeLimitGB}GB`);
        return;
    }

    setIsUploading(true);
    
    try {
        await new Promise(resolve => setTimeout(resolve, 100)); 
        await onUpload(selectedFiles, authorName);
        
        // Guardar nombre globalmente para futuros eventos
        localStorage.setItem('album_user_name', authorName);

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

  const allowed = event.allowedMediaTypes || ['photo'];
  const acceptedStr = [
      allowed.includes('photo') ? 'Imágenes' : '',
      allowed.includes('video') ? 'Videos' : ''
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
                        <div className="relative">
                            <input 
                                type="text" 
                                value={authorName}
                                onChange={(e) => {
                                    setAuthorName(e.target.value);
                                    if(error?.includes('nombre')) setError(null);
                                }}
                                disabled={isNameLocked}
                                placeholder="Ej: María García"
                                className={`w-full px-4 py-3 rounded-md border outline-none transition-all ${
                                    isNameLocked 
                                    ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' 
                                    : 'bg-white border-gray-300 focus:ring-2 text-gray-900 placeholder-gray-400'
                                }`}
                                style={!isNameLocked ? { 
                                    '--tw-ring-color': hexToRgba(theme.primaryColor, 0.5),
                                    '--tw-ring-opacity': 0.5,
                                    colorScheme: 'light' // Fuerza modo claro para cursor/autofill
                                } as React.CSSProperties : {}}
                            />
                            {isNameLocked && (
                                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <Info size={12} />
                        <span>{isNameLocked ? 'Nombre vinculado a este dispositivo.' : 'Tu nombre aparecerá en los archivos'}</span>
                        </div>
                    </div>

                    {/* Rules & Limits */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                         <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                             <Info size={12} /> Límites de subida
                         </h4>
                         <ul className="space-y-3 text-sm text-gray-600">
                             {allowed.includes('photo') && (
                                 <li className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                                     <span className="flex items-center gap-2 text-xs font-medium"><ImageIcon size={14} /> Fotos</span>
                                     <div className="flex items-center gap-2">
                                         <span className={`font-bold ${totalPhotos >= event.maxPhotosPerPerson ? "text-red-500" : "text-green-600"}`}>
                                             {totalPhotos} / {event.maxPhotosPerPerson}
                                         </span>
                                     </div>
                                 </li>
                             )}
                             {allowed.includes('video') && (
                                 <li className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                                     <span className="flex items-center gap-2 text-xs font-medium"><Video size={14} /> Videos</span>
                                     <div className="flex items-center gap-2">
                                         <span className={`font-bold ${totalVideos >= event.maxVideosPerPerson ? "text-red-500" : "text-green-600"}`}>
                                             {totalVideos} / {event.maxVideosPerPerson}
                                         </span>
                                     </div>
                                 </li>
                             )}
                             <div className="pt-2 border-t border-gray-200">
                                 {allowed.includes('video') && (
                                     <li className="flex justify-between text-xs text-gray-500">
                                         <span>Max. Video:</span>
                                         <span className="font-bold">{MAX_VIDEO_MB} MB</span>
                                     </li>
                                 )}
                                 <li className="flex justify-between text-xs text-gray-500 mt-1">
                                     <span>Max. Foto:</span>
                                     <span className="font-bold">{MAX_SIZE_MB} MB</span>
                                 </li>
                             </div>
                         </ul>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-md flex items-start gap-2 text-xs md:text-sm text-red-600 animate-pulse">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span className="leading-snug whitespace-pre-wrap">{error}</span>
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
                            {acceptedStr} permitidos
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
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
                {/* Visual ID for Troubleshooting */}
                <span className="text-[10px] text-gray-400 mr-auto">
                    ID: {effectiveDeviceId.slice(-6)}
                </span>
                
                <div className="flex gap-3">
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
                </div>
            </>
        )}

      </div>
    </div>
  );
};
