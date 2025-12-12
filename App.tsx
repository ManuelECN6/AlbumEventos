
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Lightbox } from './components/Lightbox';
import { UploadModal } from './components/UploadModal';
import { DownloadModal } from './components/DownloadModal';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Photo, EventConfig, Participant } from './types';
import { 
    subscribeToEvents, 
    subscribeToVisitorEvent, 
    saveEventToFirebase, 
    deleteEventFromFirebase, 
    processAndUploadPhoto, 
    updateEventFieldInFirebase,
    togglePhotoLike,
    softDeletePhoto,
    restorePhoto,
    permanentDeletePhoto,
    archivePhoto,
    batchUpdatePhotos,
    reportPhoto,
    resolvePhotoReport
} from './services/firebaseService';
import { 
  Heart, 
  Camera, 
  Download, 
  LayoutList, 
  LayoutGrid, 
  Flag,
  User,
  Calendar,
  X,
  Image as ImageIcon,
  Plus,
  Video,
  Loader2,
  Lock,
  ChevronDown,
  Check,
  CheckCircle,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import JSZip from 'jszip';
import saveAs from 'file-saver';

// --- PLANTILLA POR DEFECTO ---
const DEFAULT_EVENT_TEMPLATE: EventConfig = {
    id: '',
    title: 'Nuevo Evento',
    subtitle: 'Descripción del evento',
    date: 'DD/MM/AAAA',
    participantsCount: 0,
    participants: [],
    photos: [],
    categories: [{ id: 'c1', name: 'General', color: '#3b82f6' }],
    allowUploads: true,
    allowDownloads: false, 
    allowedMediaTypes: ['photo', 'video'],
    storageLimit: 100, 
    maxPhotosPerPerson: 50, 
    maxVideosPerPerson: 10, 
    maxVideoSizeMB: 512, 
    totalEventSizeLimitGB: 5,
    totalUsageBytes: 0,
    clientName: 'Cliente Nuevo',
    downloadPassword: Math.random().toString(36).slice(-6),
    publicToken: '',
    theme: {
      backgroundColor: '#f5f0e6',
      textColor: '#1f2937',
      primaryColor: '#a87b51',
      primaryTextColor: '#ffffff',
      secondaryColor: '#4f46e5',
      secondaryTextColor: '#ffffff',
      statsTextColor: '#6b7280',
      headerTitleColor: '#1f2937',
      headerDateColor: '#6b7280',
      fontFamily: 'sans',
      avatarBackgroundColor: '#374151',
      avatarTextColor: '#ffffff',
      coverOverlayColor: '#000000',
      coverOverlayOpacity: 0.4,
      coverBlur: 0,
      coverImagePositionY: 50,
      coverImagePositionDesktopY: 50,
      galleryToolbarBg: '#ffffff',
      galleryToolbarText: '#1f2937',
      cardBackgroundColor: '#ffffff',
      cardTextColor: '#1f2937'
    },
    googleDriveUrl: '',
    isDriveBackupEnabled: false
};

// --- COMPONENTE OPTIMIZADO PARA CARGA DIFERIDA DE MEDIA ---
// Solo carga la imagen/video cuando entra en el viewport
const LazyMedia = React.memo(({ src, type, alt, className }: { src: string, type?: 'photo' | 'video', alt?: string, className?: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' } // Cargar 200px antes de que aparezca
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, []);

    if (!isVisible) {
        return <div ref={ref} className={`bg-gray-100 animate-pulse ${className}`} />;
    }

    if (type === 'video') {
        return (
            <div className="relative w-full h-full">
                <video 
                    src={src} 
                    className={`${className} object-cover`} 
                    muted 
                    playsInline
                    preload="metadata" // CRÍTICO: Solo carga metadata, no todo el video
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <Video size={32} className="text-white drop-shadow-md opacity-80" />
                </div>
            </div>
        );
    }

    return (
        <img 
            src={src} 
            alt={alt || ''} 
            className={className} 
            loading="lazy" 
            decoding="async" // CRÍTICO: No bloquea el hilo principal
        />
    );
});

// --- TARJETA DE FOTO MEMOIZADA ---
// Previene re-renders innecesarios de toda la grilla cuando cambia un like
const PhotoCard = React.memo(({ 
    photo, 
    theme, 
    isDownloadSelectionMode, 
    isSelected, 
    toggleSelection, 
    onClick, 
    onLike, 
    onReport 
}: {
    photo: any,
    theme: any,
    isDownloadSelectionMode: boolean,
    isSelected: boolean,
    toggleSelection: (id: string) => void,
    onClick: () => void,
    onLike: (id: string) => void,
    onReport: (e: React.MouseEvent, id: string) => void
}) => {
    const author = photo?.author || { name: 'Anónimo', initials: 'AN', avatarColor: '#999' };
    const hexToRgba = (hex: any, alpha: number) => {
        try {
            if (!hex || typeof hex !== 'string') return 'transparent';
            if (hex.startsWith('rgba')) return hex;
            let c: any;
            if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
                c = hex.substring(1).split('');
                if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
                c = '0x' + c.join('');
                return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
            }
            return hex;
        } catch(e) { return 'transparent'; }
    };

    return (
        <article 
            className={`MV-card-foto flex flex-col overflow-hidden transition-all duration-300 border bg-white rounded-xl shadow-sm hover:shadow-md ${isDownloadSelectionMode && isSelected ? 'MV-selected border-4 border-blue-500 ring-4 ring-blue-100 scale-[0.98]' : 'border-gray-100'}`}
            style={{ 
                backgroundColor: theme.cardBackgroundColor || '#ffffff' 
            }}
        >
            <header className="flex items-start justify-between p-4 MV-encabezado-card">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 text-sm font-bold text-white rounded-full MV-avatar-circulo" style={{ backgroundColor: author.avatarColor }}>{author.initials}</div>
                    <div>
                        <h3 className="text-base font-bold" style={{ color: theme.cardTextColor || '#1f2937' }}>{author.name}</h3>
                        <p className="text-xs font-medium opacity-90" style={{ color: theme.cardTextColor || '#6b7280' }}>
                        {!isNaN(new Date(photo.createdAt).getTime()) 
                                ? new Date(photo.createdAt).toLocaleString() 
                                : photo.createdAt}
                        </p>
                    </div>
                </div>
                <button 
                    type="button"
                    onClick={(e) => onReport(e, photo.id)}
                    className="relative z-10 p-1 -mr-2 opacity-50 hover:text-red-500 hover:opacity-100 transition-all hover:scale-110 active:scale-95 cursor-pointer" 
                    style={{ color: theme.cardTextColor }}
                    title="Reportar foto"
                >
                    <Flag size={18} />
                </button>
            </header>
            
            <figure 
                className="MV-card-media relative bg-gray-100 aspect-[4/3] overflow-hidden group cursor-pointer" 
                onClick={() => {
                    if (isDownloadSelectionMode) {
                        toggleSelection(photo.id);
                    } else {
                        onClick();
                    }
                }}
            >
                {isDownloadSelectionMode && (
                    <div className={`absolute inset-0 z-20 transition-colors flex items-center justify-center ${isSelected ? 'bg-blue-500/20' : 'bg-black/0 group-hover:bg-black/10'}`}>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg transition-all transform ${isSelected ? 'bg-blue-500 border-blue-500 scale-110' : 'bg-white border-gray-300 scale-100'}`}>
                            {isSelected && <Check size={18} className="text-white" strokeWidth={3} />}
                        </div>
                    </div>
                )}

                <LazyMedia 
                    src={photo.thumbnail} 
                    type={photo.type} 
                    alt={photo.title} 
                    className="object-cover w-full h-full transition-transform duration-700 hover:scale-105"
                />
                
                <figcaption className="absolute px-2 py-1 text-[10px] font-bold text-white uppercase rounded top-3 right-3 bg-black/50 backdrop-blur-sm">{photo.category || 'General'}</figcaption>
            </figure>
            
            <footer className="flex items-center justify-between p-4 border-t MV-card-footer" style={{ borderColor: hexToRgba(theme.cardTextColor || '#000000', 0.1) }}>
                <button 
                    onClick={() => onLike(photo.id)} 
                    className={`flex items-center gap-2 text-sm font-medium transition-transform active:scale-95`} 
                    style={{ color: photo.likedByMe ? theme.secondaryColor : (theme.cardTextColor || '#6b7280') }}
                >
                    <Heart size={20} className={photo.likedByMe ? "fill-current" : ""} />
                    <span>{photo.likes || 0}</span>
                </button>
            </footer>
        </article>
    );
});


// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [events, setEvents] = useState<EventConfig[]>([]);
  // Nuevo estado para guardar los datos COMPLETOS del evento activo en modo admin
  const [adminActiveEventData, setAdminActiveEventData] = useState<EventConfig | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  // OPTIMIZACIÓN: Inicializar estado directamente desde URL para evitar re-renders y dobles lecturas
  const [isAdminMode, setIsAdminMode] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('admin') === 'true';
      }
      return false;
  });

  const [showLoginModal, setShowLoginModal] = useState(false);

  const [likedPhotoIds, setLikedPhotoIds] = useState<Set<string>>(new Set());
  
  const PHOTOS_PER_PAGE = 12;
  const [visiblePhotosCount, setVisiblePhotosCount] = useState(PHOTOS_PER_PAGE);

  const [isDownloadSelectionMode, setIsDownloadSelectionMode] = useState(false);
  const [downloadSelection, setDownloadSelection] = useState<Set<string>>(new Set());
  const [isZippingSelected, setIsZippingSelected] = useState(false);
  
  // NEW: Report Modal State for Grid View
  const [reportModal, setReportModal] = useState<{isOpen: boolean, photoId: string | null, status: 'confirm' | 'success'}>({
      isOpen: false, photoId: null, status: 'confirm'
  });

  useEffect(() => {
    let storedId = localStorage.getItem('album_device_id');
    if (!storedId) {
        storedId = 'device-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('album_device_id', storedId);
    }
    setDeviceId(storedId);
  }, []);

  useEffect(() => {
      let unsubscribe: () => void;
      const params = new URLSearchParams(window.location.search);
      const urlEventToken = params.get('event');

      // LÓGICA CRÍTICA DE COSTOS:
      // Si es Admin -> Carga toda la lista (subscribeToEvents) PERO ligera (sin fotos)
      // Si es Visitante -> Carga SOLO 1 evento (subscribeToVisitorEvent) completo
      if (isAdminMode) {
          console.log("Modo Admin: Cargando lista de eventos...");
          unsubscribe = subscribeToEvents((fetchedEvents) => {
              setEvents(fetchedEvents);
              setIsLoading(false);
          });
      } else {
          console.log("Modo Visitante: Cargando evento único...", urlEventToken || "Último");
          unsubscribe = subscribeToVisitorEvent(urlEventToken, (fetchedEvents) => {
              setEvents(fetchedEvents);
              setIsLoading(false);
          });
      }
      
      return () => {
          if (unsubscribe) unsubscribe();
      };
  }, [isAdminMode]);

  const [currentEventId, setCurrentEventId] = useState<string | null>(null);

  // --- NUEVA LÓGICA: Suscripción a detalle en Modo Admin ---
  // Cuando el admin selecciona un evento, nos suscribimos a su versión COMPLETA (con subcolección de fotos)
  // para poder ver las fotos nuevas en la galería del admin.
  useEffect(() => {
      if (isAdminMode && currentEventId) {
          console.log(`Modo Admin: Suscribiendo a detalles del evento ${currentEventId}...`);
          const unsubscribeDetail = subscribeToVisitorEvent(currentEventId, (fetchedEvents) => {
              if (fetchedEvents && fetchedEvents.length > 0) {
                  // Actualizamos el estado separado para datos detallados
                  setAdminActiveEventData(fetchedEvents[0]);
              }
          });
          return () => unsubscribeDetail();
      } else {
          setAdminActiveEventData(null);
      }
  }, [isAdminMode, currentEventId]);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('event');
    
    if (!isLoading) {
        if (events.length > 0) {
            if (token) {
                const foundEvent = events.find(e => e.publicToken === token || e.id === token);
                if (foundEvent) setCurrentEventId(foundEvent.id);
                else setCurrentEventId(events[0].id);
            } else if (!currentEventId) {
                setCurrentEventId(events[0].id);
            }
        } else {
            // SOLO CREAMOS SI NO HAY EVENTOS Y SOMOS ADMIN. SI SOMOS GUEST, MOSTRAMOS EMPTY STATE.
            if (isAdminMode && events.length === 0) {
                 handleCreateEvent();
            }
        }
    }
  }, [events, currentEventId, isLoading, isAdminMode]);

  useEffect(() => {
      if (!currentEventId) return;
      try {
          const key = `album_likes_${currentEventId}`;
          const stored = localStorage.getItem(key);
          if (stored) {
              setLikedPhotoIds(new Set(JSON.parse(stored)));
          } else {
              setLikedPhotoIds(new Set());
          }
      } catch (e) {
          console.error("Error cargando likes locales", e);
      }
      setVisiblePhotosCount(PHOTOS_PER_PAGE);
      setIsDownloadSelectionMode(false);
      setDownloadSelection(new Set());
  }, [currentEventId]);

  // CALCULO DEL EVENTO ACTIVO:
  // Si estamos en admin y tenemos datos detallados (con fotos nuevas), usamos eso.
  // Si no, usamos la lista general.
  const activeEvent = useMemo(() => {
    if (isAdminMode && adminActiveEventData && adminActiveEventData.id === currentEventId) {
        return adminActiveEventData;
    }
    // PROTECCIÓN: Si events está vacío, retorna el template para que la UI no rompa
    return events.find(e => e.id === currentEventId) || events[0] || DEFAULT_EVENT_TEMPLATE;
  }, [events, currentEventId, isAdminMode, adminActiveEventData]);

  // SYNC PARTICIPANTS LOGIC
  useEffect(() => {
      if (!activeEvent || !activeEvent.id) return;

      const currentParticipants = activeEvent.participants || [];
      const existingIds = new Set(currentParticipants.map(p => p.id));
      const existingNames = new Set(currentParticipants.map(p => p.name.toLowerCase().trim()));
      
      let hasChanges = false;
      const updatedParticipants = [...currentParticipants];
      
      // Safety check for photos array
      const safePhotos = activeEvent.photos || [];
      const activePhotos = safePhotos.filter(p => !p.isDeleted);

      activePhotos.forEach(photo => {
          // --- PROTECCIÓN CONTRA FOTOS CORRUPTAS ---
          if (!photo || !photo.author) return;

          const deviceId = photo.deviceId;
          // Validación segura de autor
          const authorName = photo.author?.name || 'Anónimo';
          const legacyId = `legacy-${authorName.replace(/\s+/g, '-').toLowerCase()}`;
          const targetId = deviceId || legacyId;
          const normalizedName = authorName.toLowerCase().trim();

          if (!existingIds.has(targetId)) {
              if (!existingNames.has(normalizedName)) {
                  updatedParticipants.push({
                      id: targetId,
                      name: authorName, 
                      status: 'confirmed',
                      addedAt: photo.createdAt.split(' ')[0] || new Date().toISOString().split('T')[0]
                  });
                  existingIds.add(targetId);
                  existingNames.add(normalizedName);
                  hasChanges = true;
              }
          }
      });

      if (hasChanges) {
          // Usamos la nueva función de solo actualizar campos para no pisar fotos
          updateEventFieldInFirebase(activeEvent.id, 'participants', updatedParticipants);
      }
  }, [activeEvent.photos, activeEvent.id]); // Eliminada dependencia cíclica profunda

  const photos = useMemo(() => {
      const rawPhotos = activeEvent?.photos || [];
      return rawPhotos.map(p => ({
          ...p,
          likedByMe: likedPhotoIds.has(p.id)
      }));
  }, [activeEvent?.photos, likedPhotoIds]);

  const guestPhotos = useMemo(() => photos.filter(p => !p.isArchived && !p.isDeleted), [photos]);

  const visiblePhotos = useMemo(() => {
      return guestPhotos.slice(0, visiblePhotosCount);
  }, [guestPhotos, visiblePhotosCount]);

  const handleLoadMore = () => {
      setVisiblePhotosCount(prev => prev + PHOTOS_PER_PAGE);
  };

  const activeParticipants = useMemo(() => 
    (activeEvent.participants || []).filter(p => p.status === 'confirmed'), 
  [activeEvent.participants]);

  // NUEVA LÓGICA DE VISUALIZACIÓN DE CUPO
  const remainingSpotsDisplay = useMemo(() => {
      const limit = activeEvent.participantsCount || 0;
      const current = activeParticipants.length;
      
      // Si el límite es 0, mostramos solo el número actual (sin texto "Ilimitado")
      if (limit === 0) {
          return `${current}`;
      }
      // Si hay límite, mostramos formato X/Y
      return `${current}/${limit}`;
  }, [activeEvent.participantsCount, activeParticipants]);

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [columns, setColumns] = useState<1 | 2>(2);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleTitleClick = () => {
      const now = Date.now();
      if (now - lastClickTimeRef.current > 1000) {
          clickCountRef.current = 0;
      }
      clickCountRef.current += 1;
      lastClickTimeRef.current = now;
      if (clickCountRef.current >= 5) {
          setShowLoginModal(true);
          clickCountRef.current = 0; 
      }
  };

  useEffect(() => {
    let buffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'F2') { e.preventDefault(); setShowLoginModal(true); return; }
        if (e.altKey && e.key.toLowerCase() === 'l') { e.preventDefault(); setShowLoginModal(true); return; }
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
            buffer += e.key.toLowerCase();
            if (buffer.length > 10) buffer = buffer.slice(-10);
            if (buffer.endsWith('admin') || buffer.endsWith('login')) { setShowLoginModal(true); buffer = ''; }
        } else { if (e.key !== 'Shift') buffer = ''; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateEvent = async () => {
    const id = `event-${Date.now()}`;
    const newEvent: EventConfig = {
      ...DEFAULT_EVENT_TEMPLATE,
      id,
      publicToken: `evento-${Date.now().toString(36)}`,
      downloadPassword: Math.random().toString(36).slice(-6),
      photos: [], 
      participants: []
    };
    await saveEventToFirebase(newEvent);
    setCurrentEventId(id);
  };

  const handleUpdateEvent = async (updatedEvent: EventConfig) => {
    await saveEventToFirebase(updatedEvent);
  };

  const handleUpdateEventField = async (fieldPath: string, value: any) => {
    if (!activeEvent?.id) return;
    try {
        await updateEventFieldInFirebase(activeEvent.id, fieldPath, value);
    } catch (error: any) {
        console.error(`Failed to update field ${fieldPath}:`, error);
        alert(`Hubo un error: ${error.message}`);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (events.length <= 1) {
      alert("No puedes eliminar el último evento.");
      return;
    }
    const remainingEvents = events.filter(e => e.id !== id);
    const nextEventId = remainingEvents.length > 0 ? remainingEvents[0].id : null;

    setEvents(remainingEvents); 
    if (currentEventId === id && nextEventId) {
        setCurrentEventId(nextEventId); 
    }

    try {
        setIsProcessing(true);
        await deleteEventFromFirebase(id);
    } catch (error) {
        console.error("Error eliminando evento:", error);
        window.location.reload();
    } finally {
        setIsProcessing(false);
    }
  };

  const handlePhotoUpload = async (files: File[], authorName: string) => {
    const authorColor = activeEvent.theme?.primaryColor || '#a87b51';

    // No actualizamos el estado local manualmente. Confiamos en la suscripción de Firestore.
    // Solo subimos los archivos y la base de datos disparará el update.
    for (const file of files) {
        try {
            await processAndUploadPhoto(
                file, 
                activeEvent.id, 
                authorName, 
                authorColor,
                deviceId 
            );
        } catch (error) {
            console.error("Error subiendo archivo:", file.name, error);
        }
    }
    // La actualización de participantes se manejará en el useEffect de sincronización
  };

  const handleDriveImport = async (files: File[]) => {
    setIsProcessing(true);
    try {
        const authorName = activeEvent.clientName || 'Admin';
        const authorColor = activeEvent.theme?.secondaryColor || '#4f46e5';
        const importerDeviceId = `drive-importer-${activeEvent.id}`;

        for (const file of files) {
            try {
                await processAndUploadPhoto(file, activeEvent.id, authorName, authorColor, importerDeviceId);
            } catch (error) {
                console.error(`Error processing Drive file ${file.name}:`, error);
            }
        }
    } catch (error: any) {
        console.error("Failed to import from Google Drive:", error);
        alert(`Error al importar: ${error.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  // CALLBACKS MEMOIZADOS PARA OPTIMIZAR GRID
  const handleLike = useCallback(async (photoId: string) => {
      if (!activeEvent?.id) return;
      
      setLikedPhotoIds(prev => {
          const newLikedIds = new Set(prev);
          const isLiked = newLikedIds.has(photoId);
          if (isLiked) {
              newLikedIds.delete(photoId);
          } else {
              newLikedIds.add(photoId);
          }
          // Guardar en local
          localStorage.setItem(`album_likes_${activeEvent.id}`, JSON.stringify(Array.from(newLikedIds)));
          return newLikedIds;
      });

      // Llamada atómica optimizada
      // Nota: Leemos el estado anterior para saber si estaba liked, 
      // pero como estamos en un callback, lo ideal es que este componente sepa el estado
      // actual. Sin embargo, para la UI rápida, esto funciona.
      // Corrección: togglePhotoLike necesita saber si incrementamos o no.
      // Como no tenemos el estado 'isLiked' dentro de este callback de forma síncrona exacta,
      // confiamos en que el componente hijo ya sabe su estado o pasamos la lógica.
      // Simplemente invertimos lo que tenemos en el Set actual
      setLikedPhotoIds(current => {
          const isLiked = current.has(photoId);
          togglePhotoLike(activeEvent.id, photoId, !isLiked);
          return current;
      });
  }, [activeEvent?.id]);

  const handleReport = async (photoId: string) => {
     if (!activeEvent || !activeEvent.id) return;
     try {
         await reportPhoto(activeEvent.id, photoId);
     } catch (error) {
         console.error("Error reportando foto:", error);
     }
  };

  const openReportModal = useCallback((e: React.MouseEvent, photoId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setReportModal({ isOpen: true, photoId, status: 'confirm' });
  }, []);

  const confirmReportFromModal = async () => {
      if (!reportModal.photoId) return;
      
      // Optimistic update
      setReportModal(prev => ({ ...prev, status: 'success' }));
      
      await handleReport(reportModal.photoId);
      
      setTimeout(() => {
          setReportModal({ isOpen: false, photoId: null, status: 'confirm' });
      }, 2000);
  };

  const handleResolveReport = async (photoId: string) => {
      if (!currentEventId) return;
      await resolvePhotoReport(currentEventId, photoId);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!currentEventId) return;
    try {
      await softDeletePhoto(currentEventId, photoId);
    } catch (error: any) {
      console.error("Error soft delete:", error);
      alert(`Error al eliminar: ${error.message}`);
    }
  };

  const handleRestorePhoto = (photoId: string) => {
      if (!currentEventId) return;
      restorePhoto(currentEventId, photoId);
  };

  const handlePermanentPhotoRemoval = async (photoIdsToRemove: string[]) => {
    if (!currentEventId || photoIdsToRemove.length === 0) return;
    setIsProcessing(true);
    try {
      const latestEvent = activeEvent; // Usamos el estado actual que está sincronizado
      const idsSet = new Set(photoIdsToRemove);
      const photosToDelete = latestEvent.photos.filter(p => idsSet.has(p.id));

      const CHUNK_SIZE = 3; 
      for (let i = 0; i < photosToDelete.length; i += CHUNK_SIZE) {
          const chunk = photosToDelete.slice(i, i + CHUNK_SIZE);
          await Promise.allSettled(chunk.map(p => permanentDeletePhoto(currentEventId, p.id, p.url)));
      }
      alert(`Eliminados ${photoIdsToRemove.length} elementos permanentemente.`);
    } catch (error: any) {
      console.error("Error eliminación permanente:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchivePhoto = (photoId: string) => {
      if (!currentEventId) return;
      const photo = activeEvent.photos.find(p => p.id === photoId);
      if (photo) {
          archivePhoto(currentEventId, photoId, !photo.isArchived);
      }
  };

  const handleBulkDelete = async (photoIds: string[]) => {
    if (!currentEventId) return;
    try {
        await batchUpdatePhotos(currentEventId, photoIds, { isDeleted: true });
    } catch (error) {
        console.error("Error bulk delete:", error);
        alert("Error al eliminar fotos.");
    }
  };

  const handleBulkRestore = async (photoIds: string[]) => {
      if (!currentEventId) return;
      await batchUpdatePhotos(currentEventId, photoIds, { isDeleted: false, isArchived: false });
  };

  const handleBulkArchive = async (photoIds: string[], shouldArchive: boolean) => {
      if (!currentEventId) return;
      await batchUpdatePhotos(currentEventId, photoIds, { isArchived: shouldArchive });
  };

  const handleEnableSelectionMode = () => {
      setIsDownloadSelectionMode(true);
      setDownloadSelection(new Set());
      setIsDownloadModalOpen(false); 
  };

  const toggleDownloadSelection = useCallback((id: string) => {
      setDownloadSelection(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          return newSet;
      });
  }, []);

  const handleDownloadSelectedFiles = async () => {
      const selectedIds = Array.from(downloadSelection);
      const photosToDownload = guestPhotos.filter(p => selectedIds.includes(p.id));
      
      if (photosToDownload.length === 0) return;
      setIsZippingSelected(true);
      
      try {
          const zip = new JSZip();
          const folder = zip.folder("recuerdos_seleccionados");
          let failedCount = 0;

          for (const photo of photosToDownload) {
              if (!photo.url) continue;
              try {
                  const fetchUrl = `${photo.url}${photo.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
                  const response = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
                  if (!response.ok) throw new Error("Fetch failed");
                  
                  const blob = await response.blob();
                  const ext = photo.type === 'video' ? 'mp4' : 'jpg';
                  const filename = `${(photo.title || 'foto').replace(/[^a-z0-9]/gi, '_')}_${photo.id.slice(-4)}.${ext}`;
                  folder?.file(filename, blob);
              } catch (err) {
                  failedCount++;
              }
              await new Promise(r => setTimeout(r, 100));
          }

          if (failedCount === photosToDownload.length) {
              alert("Error de descarga. Verifica CORS en Firebase.");
          } else {
              const content = await zip.generateAsync({ type: "blob" });
              saveAs(content, "seleccion_recuerdos.zip");
          }
      } catch (error) {
          console.error("Error ZIP:", error);
          alert("Error generando ZIP.");
      } finally {
          setIsZippingSelected(false);
          setIsDownloadSelectionMode(false);
          setDownloadSelection(new Set());
      }
  };

  // --- SAFE THEME MERGING ---
  const theme = useMemo(() => {
      const defaults = DEFAULT_EVENT_TEMPLATE.theme!;
      // Si no hay evento activo o no tiene tema, usamos el default
      if (!activeEvent || !activeEvent.theme) return defaults;
      return { ...defaults, ...activeEvent.theme };
  }, [activeEvent]);

  const fontClass = theme.fontFamily === 'serif' ? 'font-serif' : 'font-sans';
  
  // --- SAFE HEX TO RGBA ---
  const hexToRgba = (hex: any, alpha: number) => {
    try {
        if (!hex || typeof hex !== 'string') return 'transparent';
        if (hex.startsWith('rgba')) return hex;
        let c: any;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            c = '0x' + c.join('');
            return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
        }
        return hex;
    } catch(e) {
        return 'transparent';
    }
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 MV-loader-container">
              <Loader2 size={48} className="mb-4 text-blue-500 animate-spin" />
              <p className="text-gray-500">Conectando con el Álbum...</p>
          </div>
      );
  }

  if (isAdminMode) {
    return (
      <ErrorBoundary>
        <AdminPanel 
            key={currentEventId || 'admin-panel'} // FORCE RE-RENDER ON EVENT CHANGE
            events={events}
            currentEventId={activeEvent.id}
            currentEventPhotos={photos} // photos comes from useMemo based on activeEvent.photos
            isProcessing={isProcessing}
            onUpdateEvent={handleUpdateEvent}
            onUpdateField={handleUpdateEventField}
            onCreateEvent={handleCreateEvent}
            onSelectEvent={setCurrentEventId}
            onDeleteEvent={handleDeleteEvent}
            onDeletePhoto={handleDeletePhoto}
            onRestorePhoto={handleRestorePhoto}
            onPermanentDelete={(id) => handlePermanentPhotoRemoval([id])}
            onArchivePhoto={handleArchivePhoto}
            onBulkDelete={handleBulkDelete}
            onBulkArchive={handleBulkArchive}
            onBulkRestore={handleBulkRestore}
            onBulkPermanentDelete={handlePermanentPhotoRemoval}
            onDriveImport={handleDriveImport}
            onResolveReport={handleResolveReport}
            onExit={() => {
                setIsAdminMode(false);
                setIsLoading(true); // Force reload when exiting to visitor
            }} 
        />
      </ErrorBoundary>
    );
  }
  
  // --- PANTALLA SEGURA PARA BASE DE DATOS VACÍA ---
  // Si no hay evento activo (ID vacío) y no somos admin, mostramos esto para evitar crash
  if (!activeEvent || !activeEvent.id) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-400">
                  <AlertTriangle size={40} />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Álbum No Encontrado</h1>
              <p className="text-gray-600 max-w-md mb-8">
                  No se pudo encontrar el evento solicitado. Es posible que haya sido eliminado o el enlace sea incorrecto.
              </p>
              
              {/* Botón "Secret" para ir a Admin si el usuario es dueño */}
              <button 
                  onClick={() => setIsAdminMode(true)}
                  className="text-sm text-blue-600 hover:underline font-medium"
              >
                  Soy el administrador
              </button>
          </div>
      );
  }
  
  const mobilePos = theme.coverImagePositionY || 50;
  const desktopPos = theme.coverImagePositionDesktopY ?? mobilePos;

  return (
    <ErrorBoundary>
        <main 
            className={`MV-layout-raiz ${fontClass} min-h-screen pb-8 relative font-sans transition-colors duration-500 select-none bg-album-bg`}
            style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
        >
        <style>{`
            .custom-cover-position {
                object-position: 50% ${mobilePos}%;
            }
            @media (min-width: 768px) {
                .custom-cover-position {
                    object-position: 50% ${desktopPos}%;
                }
            }
        `}</style>
        
        {/* REPORT MODAL FOR GRID VIEW - FIXED Z-INDEX AND VISIBILITY */}
        {reportModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReportModal({ ...reportModal, isOpen: false })} />
                <div className="relative bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in-up text-center z-10">
                    {reportModal.status === 'success' ? (
                        <>
                            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 text-green-500 bg-green-100 rounded-full animate-bounce">
                                <CheckCircle size={32} strokeWidth={3} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">¡Reporte Enviado!</h3>
                            <p className="text-gray-500 text-sm">Gracias por ayudarnos a mantener segura la galería.</p>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 text-red-500 bg-red-100 rounded-full">
                                <ShieldAlert size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">¿Reportar contenido?</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                Si esta foto es inapropiada, confírmalo para que el administrador la revise.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button 
                                    onClick={() => setReportModal({ ...reportModal, isOpen: false })}
                                    className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmReportFromModal}
                                    className="px-5 py-2.5 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 shadow-md transition-colors flex items-center gap-2"
                                >
                                    <Flag size={16} /> Reportar
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}

        {showLoginModal && (
            <section className="fixed inset-0 z-50 flex items-center justify-center p-4 MV-modal-acceso">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLoginModal(false)} />
            <div className="relative z-10 w-full max-w-sm p-8 bg-white shadow-2xl rounded-2xl animate-fade-in-up">
                <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                <header className="mb-6 text-center">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 text-gray-600 bg-gray-100 rounded-full"><Lock size={32} /></div>
                <h2 className="text-2xl font-bold text-gray-800">Acceso Admin</h2>
                </header>
                <form onSubmit={(e) => { 
                    e.preventDefault(); 
                    if(passwordInput === 'admin') { 
                        // FIX: Force loading state to reset UI while fetching admin data
                        setIsLoading(true);
                        // FIX: Remove history manipulation that crashes in iframes/previews
                        setIsAdminMode(true); 
                        setShowLoginModal(false); 
                    } else { 
                        setLoginError(true); 
                    }
                }}>
                <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => { setPasswordInput(e.target.value); setLoginError(false); }}
                    placeholder="Contraseña (admin)"
                    className={`w-full px-4 py-3 mb-4 text-center border rounded-lg outline-none focus:ring-2 ${loginError ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-300'}`}
                />
                <button type="submit" className="w-full py-3 font-bold text-white bg-gray-900 rounded-lg">Entrar</button>
                </form>
            </div>
            </section>
        )}

        {isDownloadSelectionMode && (
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-xl MV-barra-seleccion animate-slide-up">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => { setIsDownloadSelectionMode(false); setDownloadSelection(new Set()); }}
                            className="font-medium text-gray-500 transition-colors hover:text-gray-800"
                        >
                            Cancelar
                        </button>
                        <span className="px-3 py-1 text-sm font-bold text-gray-700 bg-gray-100 rounded-full">
                            {downloadSelection.size} seleccionados
                        </span>
                    </div>
                    <button 
                        onClick={handleDownloadSelectedFiles}
                        disabled={downloadSelection.size === 0 || isZippingSelected}
                        className="flex items-center gap-2 px-6 py-2.5 font-bold text-white transition-all bg-blue-600 rounded-full shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isZippingSelected ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                        {isZippingSelected ? 'Procesando...' : `Descargar (${downloadSelection.size})`}
                    </button>
                </div>
            </div>
        )}

        <section className="relative mb-8 overflow-hidden group MV-seccion-portada">
            {activeEvent.coverImage && (
                <figure className="absolute inset-0 z-0 w-full h-full overflow-hidden MV-contenedor-imagen">
                    <img 
                        src={activeEvent.coverImage} 
                        className="w-full h-full transition-all duration-500 object-cover custom-cover-position" 
                        alt="Cover" 
                        style={{ 
                            filter: `blur(${theme.coverBlur || 0}px)` 
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                </figure>
            )}
            
            <div 
                className="absolute inset-0 z-0 transition-colors duration-500" 
                style={{ backgroundColor: hexToRgba(theme.coverOverlayColor || '#000000', theme.coverOverlayOpacity ?? 0.4) }}
            />

            <header className={`MV-nav-main relative z-10 max-w-6xl mx-auto animate-fade-in ${activeEvent.coverImage ? 'py-12 px-4 md:px-8' : 'pt-8 px-4 md:px-8'}`}>
                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center MV-nav-contenido">
                <div className="flex items-start gap-4">
                    
                    {theme.avatarImage ? (
                        <div className="flex-shrink-0 w-16 h-16 overflow-hidden border-2 rounded-full shadow-sm border-white/20 MV-logo-contenedor">
                            <img src={theme.avatarImage} alt="Logo" className="object-cover w-full h-full pointer-events-none" />
                        </div>
                    ) : (
                        <div 
                            className="flex items-center justify-center flex-shrink-0 w-16 h-16 text-xl font-bold uppercase border-2 rounded-full shadow-sm MV-avatar-default border-white/20"
                            style={{ 
                                backgroundColor: theme.avatarBackgroundColor || '#374151', 
                                color: theme.avatarTextColor || '#ffffff' 
                            }}
                        >
                            {(activeEvent.title || 'EV').substring(0, 2)}
                        </div>
                    )}
                    
                    <div className="MV-detalles-evento">
                    <h1 
                        onClick={handleTitleClick}
                        className="text-2xl font-bold transition-opacity cursor-default select-none md:text-3xl active:opacity-80" 
                        style={{ color: theme.headerTitleColor || theme.textColor }}
                        title=" "
                    >
                        {activeEvent.title || 'Nuevo Evento'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm MV-meta-info">
                        <div className="flex items-center gap-2" style={{ color: theme.headerDateColor || theme.textColor }}>
                            <User size={14} />
                            <span>{activeEvent.subtitle}</span>
                        </div>
                        <span className="mx-1 opacity-50">•</span>
                        <div className="flex items-center gap-2" style={{ color: theme.headerDateColor || theme.textColor }}>
                            <Calendar size={14} />
                            <span>{activeEvent.date}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 mt-3 text-xs font-bold tracking-wide uppercase MV-estadisticas" style={{ color: theme.statsTextColor || theme.textColor }}>
                        <div className="flex flex-col items-center">
                            <span className="text-lg leading-none">{guestPhotos.length}</span>
                            <span>Fotos</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-lg leading-none">{guestPhotos.reduce((acc, curr) => acc + (curr.likes || 0), 0)}</span>
                            <span>Likes</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-lg leading-none">{remainingSpotsDisplay}</span>
                            <span>Invitados</span>
                        </div>
                    </div>
                    </div>
                </div>
                <nav className="flex w-full gap-3 mt-2 md:w-auto md:mt-0 MV-botones-accion">
                    {activeEvent.allowUploads && (
                    <button 
                        onClick={() => setIsUploadModalOpen(true)} 
                        style={{ backgroundColor: theme.primaryColor, color: theme.primaryTextColor }} 
                        className="flex items-center justify-center flex-1 gap-2 px-6 py-2.5 font-medium transition-all rounded-full shadow-md md:flex-none hover:opacity-90"
                    >
                        <Camera size={18} /> Subir
                    </button>
                    )}
                    <button 
                        onClick={() => setIsDownloadModalOpen(true)} 
                        style={{ backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor }} 
                        className="flex items-center justify-center flex-1 gap-2 px-6 py-2.5 font-medium transition-all rounded-full shadow-md md:flex-none hover:opacity-90"
                    >
                    <Download size={18} /> Descargar
                    </button>
                </nav>
                </div>
            </header>
        </section>

        {guestPhotos.length > 0 && (
            <div className="max-w-6xl px-4 mx-auto mb-6 md:px-8 MV-barra-herramientas">
                <div 
                    className="flex flex-col items-center justify-between gap-4 p-4 border border-gray-100 shadow-sm rounded-xl sm:flex-row"
                    style={{ 
                        backgroundColor: theme.galleryToolbarBg || '#ffffff',
                        color: theme.galleryToolbarText || '#374151'
                    }}
                >
                <div className="flex items-center w-full gap-4 sm:w-auto">
                    <span className="flex items-center gap-2 font-bold"><LayoutGrid size={20} /> Vista de Galería</span>
                    <div className={`hidden md:flex gap-2 ml-auto sm:ml-4 ${isDownloadSelectionMode ? 'opacity-50 pointer-events-none' : ''}`}>
                        <button onClick={() => setColumns(1)} className={`px-4 py-1.5 rounded-md border text-sm font-medium ${columns === 1 ? 'shadow-sm' : 'bg-transparent border-current opacity-70'}`} style={columns === 1 ? { backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor, borderColor: theme.secondaryColor } : {}}><LayoutList size={16} /></button>
                        <button onClick={() => setColumns(2)} className={`px-4 py-1.5 rounded-md border text-sm font-medium ${columns === 2 ? 'shadow-sm' : 'bg-transparent border-current opacity-70'}`} style={columns === 2 ? { backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor, borderColor: theme.secondaryColor } : {}}><LayoutGrid size={16} /></button>
                    </div>
                </div>
                </div>
            </div>
        )}

        <section className="max-w-6xl px-4 mx-auto md:px-8 MV-contenido-principal">
            {guestPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl" style={{ borderColor: hexToRgba(theme.textColor, 0.2) }}>
                    <div className="flex items-center justify-center w-24 h-24 mb-6 rounded-full" style={{ backgroundColor: hexToRgba(theme.primaryColor, 0.1) }}>
                        <ImageIcon size={48} style={{ color: theme.primaryColor }} />
                    </div>
                    <h3 className="mb-3 text-2xl font-bold" style={{ color: theme.textColor }}>Aún no hay recuerdos aquí</h3>
                    <p className="max-w-md mb-8 text-lg opacity-70" style={{ color: theme.textColor }}>Sé el primero en compartir un momento especial.</p>
                    {activeEvent.allowUploads && (
                        <button 
                            onClick={() => setIsUploadModalOpen(true)} 
                            className="flex items-center gap-2 px-8 py-4 font-bold transition-all rounded-full shadow-lg hover:scale-105" 
                            style={{ backgroundColor: theme.primaryColor, color: theme.primaryTextColor }}
                        >
                            <Plus size={20} /> Subir
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className={`MV-muro-recuerdos grid gap-6 ${columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {visiblePhotos.map((photo, index) => {
                        return (
                            <PhotoCard 
                                key={photo.id}
                                photo={photo}
                                theme={theme}
                                isDownloadSelectionMode={isDownloadSelectionMode}
                                isSelected={downloadSelection.has(photo.id)}
                                toggleSelection={toggleDownloadSelection}
                                onClick={() => setSelectedPhotoIndex(index)}
                                onLike={handleLike}
                                onReport={openReportModal}
                            />
                        );
                    })}
                    </div>

                    {visiblePhotosCount < guestPhotos.length && (
                        <div className="flex justify-center mt-10 mb-6">
                            <button 
                                onClick={handleLoadMore}
                                className="flex items-center gap-2 px-8 py-3 font-bold text-gray-600 transition-all transform bg-white border border-gray-200 rounded-full shadow-md hover:bg-gray-50 hover:text-gray-900 hover:scale-105"
                            >
                                <ChevronDown size={20} />
                                Cargar más recuerdos ({guestPhotos.length - visiblePhotosCount} restantes)
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>

        <Lightbox 
            photo={selectedPhotoIndex !== null ? visiblePhotos[selectedPhotoIndex] : null}
            isOpen={selectedPhotoIndex !== null}
            onClose={() => setSelectedPhotoIndex(null)}
            onNext={() => selectedPhotoIndex !== null && selectedPhotoIndex < visiblePhotos.length - 1 && setSelectedPhotoIndex(selectedPhotoIndex + 1)}
            onPrev={() => selectedPhotoIndex !== null && selectedPhotoIndex > 0 && setSelectedPhotoIndex(selectedPhotoIndex - 1)}
            hasNext={selectedPhotoIndex !== null && selectedPhotoIndex < visiblePhotos.length - 1}
            hasPrev={selectedPhotoIndex !== null && selectedPhotoIndex > 0}
            onLike={handleLike}
            onReport={handleReport}
            allPhotos={visiblePhotos}
            onSelect={setSelectedPhotoIndex}
            allowDownloads={activeEvent.allowDownloads ?? false}
        />

        <UploadModal 
            isOpen={isUploadModalOpen} 
            onClose={() => setIsUploadModalOpen(false)} 
            event={activeEvent} 
            onUpload={handlePhotoUpload}
            deviceId={deviceId}
        />
        <DownloadModal 
            isOpen={isDownloadModalOpen} 
            onClose={() => setIsDownloadModalOpen(false)} 
            event={activeEvent} 
            onSelectManual={handleEnableSelectionMode}
        />
        </main>
    </ErrorBoundary>
  );
}
