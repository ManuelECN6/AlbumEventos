import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lightbox } from './components/Lightbox';
import { UploadModal } from './components/UploadModal';
import { DownloadModal } from './components/DownloadModal';
import { AdminPanel } from './components/AdminPanel';
import { Photo, EventConfig, Participant } from './types';
import { subscribeToEvents, saveEventToFirebase, deleteEventFromFirebase, processAndUploadPhoto, deleteFileFromFirebase, getEvent, updateEventFieldInFirebase } from './services/firebaseService';
import { 
  Heart, 
  Camera, 
  Download, 
  LayoutList, 
  LayoutGrid, 
  Flag,
  User,
  Calendar,
  Settings,
  X,
  Image as ImageIcon,
  Plus,
  Video,
  Loader2,
  Lock,
  ChevronDown,
  Check,
  CheckCircle,
  Package
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
    allowDownloads: false, // Por defecto desactivado
    allowedMediaTypes: ['photo'],
    storageLimit: 100,
    maxPhotosPerPerson: 25,
    maxVideosPerPerson: 5,
    maxVideoSizeMB: 50,
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

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  // Estado inicial vacío, se llenará con Firebase
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // Estado global de carga para operaciones
  const [deviceId, setDeviceId] = useState<string>('');

  // Estado local para los Likes (Persistencia por dispositivo)
  const [likedPhotoIds, setLikedPhotoIds] = useState<Set<string>>(new Set());
  
  // PAGINACIÓN
  const PHOTOS_PER_PAGE = 12;
  const [visiblePhotosCount, setVisiblePhotosCount] = useState(PHOTOS_PER_PAGE);

  // DOWNLOAD SELECTION MODE STATES
  const [isDownloadSelectionMode, setIsDownloadSelectionMode] = useState(false);
  const [downloadSelection, setDownloadSelection] = useState<Set<string>>(new Set());
  const [isZippingSelected, setIsZippingSelected] = useState(false);

  // --- IDENTIFICACIÓN DE DISPOSITIVO ---
  useEffect(() => {
    // Intentar obtener ID del localStorage
    let storedId = localStorage.getItem('album_device_id');
    if (!storedId) {
        // Si no existe, crear uno nuevo (UUID simple)
        storedId = 'device-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('album_device_id', storedId);
    }
    setDeviceId(storedId);
  }, []);

  // --- CONEXIÓN CON FIREBASE (REALTIME) ---
  useEffect(() => {
      // Suscribirse a cambios en la base de datos
      const unsubscribe = subscribeToEvents((fetchedEvents) => {
          setEvents(fetchedEvents);
          setIsLoading(false);
      });
      
      // Limpiar suscripción al desmontar
      return () => unsubscribe();
  }, []);

  // Lógica de selección de evento por URL
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('event');
    
    if (!isLoading && events.length > 0) {
        if (token) {
            const foundEvent = events.find(e => e.publicToken === token || e.id === token);
            if (foundEvent) setCurrentEventId(foundEvent.id);
            else if (!currentEventId) setCurrentEventId(events[0].id);
        } else if (!currentEventId) {
            setCurrentEventId(events[0].id);
        }
    } else if (!isLoading && events.length === 0) {
        // Si no hay eventos en Firebase, crear uno por defecto automáticamente
        handleCreateEvent();
    }
  }, [events, currentEventId, isLoading]);

  // Cargar Likes desde LocalStorage cuando cambia el evento
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
      // Reset pagination on event change
      setVisiblePhotosCount(PHOTOS_PER_PAGE);
      setIsDownloadSelectionMode(false);
      setDownloadSelection(new Set());
  }, [currentEventId]);

  const activeEvent = useMemo(() => 
    events.find(e => e.id === currentEventId) || events[0] || DEFAULT_EVENT_TEMPLATE
  , [events, currentEventId]);

  // --- SYNC PARTICIPANTS FROM PHOTOS (BACKFILL & DEDUPLICATION) ---
  useEffect(() => {
      if (!activeEvent || !activeEvent.photos) return;

      const currentParticipants = activeEvent.participants || [];
      // Mapas para búsqueda rápida
      const existingIds = new Set(currentParticipants.map(p => p.id));
      const existingNames = new Set(currentParticipants.map(p => p.name.toLowerCase().trim()));
      
      let hasChanges = false;
      const updatedParticipants = [...currentParticipants];

      // Solo consideramos fotos que NO están en la papelera (deleted)
      const activePhotos = activeEvent.photos.filter(p => !p.isDeleted);

      activePhotos.forEach(photo => {
          // 1. Intentar identificar por ID de dispositivo primero
          const deviceId = photo.deviceId;
          // 2. Fallback a nombre legacy
          const legacyId = `legacy-${photo.author.name.replace(/\s+/g, '-').toLowerCase()}`;
          
          // El ID real que usaremos para comprobar existencia técnica
          const targetId = deviceId || legacyId;
          const normalizedName = photo.author.name.toLowerCase().trim();

          // Lógica de Deduplicación:
          if (!existingIds.has(targetId)) {
              if (!existingNames.has(normalizedName)) {
                  // No existe ni el ID ni el Nombre -> Es nuevo
                  updatedParticipants.push({
                      id: targetId,
                      name: photo.author.name, 
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
          const updatedEvent = { ...activeEvent, participants: updatedParticipants };
          saveEventToFirebase(updatedEvent);
      }
  }, [activeEvent.photos, activeEvent.id, activeEvent.participants]); 

  // Combinar fotos de DB con estado local de Likes
  const photos = useMemo(() => {
      const rawPhotos = activeEvent?.photos || [];
      return rawPhotos.map(p => ({
          ...p,
          likedByMe: likedPhotoIds.has(p.id)
      }));
  }, [activeEvent?.photos, likedPhotoIds]);

  // Guest photos should not be archived AND not be deleted
  const guestPhotos = useMemo(() => photos.filter(p => !p.isArchived && !p.isDeleted), [photos]);

  // PAGINATION: Slice the visible photos
  const visiblePhotos = useMemo(() => {
      return guestPhotos.slice(0, visiblePhotosCount);
  }, [guestPhotos, visiblePhotosCount]);

  const handleLoadMore = () => {
      setVisiblePhotosCount(prev => prev + PHOTOS_PER_PAGE);
  };

  // Filter active participants (exclude deleted/trash)
  const activeParticipants = useMemo(() => 
    (activeEvent.participants || []).filter(p => p.status === 'confirmed'), 
  [activeEvent.participants]);

  // STATS CALCULATIONS
  const remainingSpotsDisplay = useMemo(() => {
      const totalCapacity = activeEvent.participantsCount || 0;
      const currentRegistered = activeParticipants.length;
      const remaining = Math.max(0, totalCapacity - currentRegistered);
      return `${remaining}/${totalCapacity}`;
  }, [activeEvent.participantsCount, activeParticipants]);


  // Estados de UI
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [columns, setColumns] = useState<1 | 2>(2);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // --- SECRET ADMIN ACCESS (CLICK TRIGGER) ---
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleTitleClick = () => {
      const now = Date.now();
      // Reset if too slow (more than 1 second between clicks)
      if (now - lastClickTimeRef.current > 1000) {
          clickCountRef.current = 0;
      }
      
      clickCountRef.current += 1;
      lastClickTimeRef.current = now;

      if (clickCountRef.current >= 5) {
          setShowLoginModal(true);
          clickCountRef.current = 0; // Reset after triggering
      }
  };

  // --- LISTENER PARA ACCESO OCULTO (TECLADO) ---
  useEffect(() => {
    let buffer = '';
    
    const handleKeyDown = (e: KeyboardEvent) => {
        // 1. Tecla F2 (Simple y directa)
        if (e.key === 'F2') {
            e.preventDefault();
            setShowLoginModal(true);
            return;
        }

        // 2. Combinación Alt + L (Login)
        if (e.altKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            setShowLoginModal(true);
            return;
        }

        // 3. "Palabra Mágica" (Escribir 'admin' o 'login' en cualquier parte)
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
            buffer += e.key.toLowerCase();
            if (buffer.length > 10) buffer = buffer.slice(-10);

            if (buffer.endsWith('admin') || buffer.endsWith('login')) {
                setShowLoginModal(true);
                buffer = ''; 
            }
        } else {
            if (e.key !== 'Shift') buffer = '';
        }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
        setShowLoginModal(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  // --- ACCIONES (CONECTADAS A FIREBASE) ---

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
        alert(`Hubo un error al guardar el cambio para ${fieldPath}: ${error.message}`);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (events.length <= 1) {
      alert("No puedes eliminar el último evento. Debes tener al menos uno.");
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
        alert("Hubo un error al eliminar el evento de la base de datos.");
        window.location.reload();
    } finally {
        setIsProcessing(false);
    }
  };

  const handlePhotoUpload = async (files: File[], authorName: string) => {
    const newPhotos: Photo[] = [];
    const authorColor = activeEvent.theme?.primaryColor || '#a87b51';

    for (const file of files) {
        try {
            const photoObject = await processAndUploadPhoto(
                file, 
                activeEvent.id, 
                authorName, 
                authorColor,
                deviceId 
            );
            newPhotos.push(photoObject);
        } catch (error) {
            console.error("Error subiendo archivo:", file.name, error);
        }
    }

    if (newPhotos.length > 0) {
        let currentParticipants = [...(activeEvent.participants || [])];
        const userId = deviceId; 
        
        const participantIndexById = currentParticipants.findIndex(p => p.id === userId);
        const participantIndexByName = currentParticipants.findIndex(p => p.name.toLowerCase() === authorName.toLowerCase());
        
        if (participantIndexById === -1 && participantIndexByName === -1) {
            const newParticipant: Participant = {
                id: userId, 
                name: authorName,
                status: 'confirmed', 
                addedAt: new Date().toISOString().split('T')[0]
            };
            currentParticipants.push(newParticipant);
        } else {
             const indexToUpdate = participantIndexById !== -1 ? participantIndexById : participantIndexByName;
             
             if (indexToUpdate !== -1) {
                 if (currentParticipants[indexToUpdate].status === 'declined') {
                     currentParticipants[indexToUpdate] = {
                         ...currentParticipants[indexToUpdate],
                         status: 'confirmed',
                         name: authorName
                     };
                 }
             }
        }

        const updatedEvent = {
            ...activeEvent,
            photos: [...newPhotos, ...activeEvent.photos],
            participants: currentParticipants
        };
        await saveEventToFirebase(updatedEvent);
    }
  };

  const handleDriveImport = async (files: File[]) => {
    setIsProcessing(true);
    try {
        const authorName = activeEvent.clientName || 'Admin';
        const authorColor = activeEvent.theme?.secondaryColor || '#4f46e5';
        const newPhotos: Photo[] = [];

        for (const file of files) {
            try {
                const importerDeviceId = `drive-importer-${activeEvent.id}`;
                const photoObject = await processAndUploadPhoto(file, activeEvent.id, authorName, authorColor, importerDeviceId);
                newPhotos.push(photoObject);
            } catch (error) {
                console.error(`Error processing Drive file ${file.name}:`, error);
            }
        }

        if (newPhotos.length > 0) {
            const latestEvent = await getEvent(activeEvent.id);
            if (!latestEvent) throw new Error("Event not found for Drive import.");

            let updatedParticipants = [...(latestEvent.participants || [])];
            const importerDeviceId = `drive-importer-${latestEvent.id}`;

            const existingIndex = updatedParticipants.findIndex(p => p.id === importerDeviceId || p.name === authorName);
            
            if (existingIndex === -1) {
                updatedParticipants.push({
                    id: importerDeviceId,
                    name: authorName,
                    status: 'confirmed',
                    addedAt: new Date().toISOString().split('T')[0],
                });
            }

            const updatedEvent = {
                ...latestEvent,
                photos: [...newPhotos, ...latestEvent.photos],
                participants: updatedParticipants,
            };
            await saveEventToFirebase(updatedEvent);
        }
    } catch (error: any) {
        console.error("Failed to import from Google Drive:", error);
        alert(`Hubo un error al importar las fotos de Google Drive: ${error.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleLike = async (photoId: string) => {
      if (!activeEvent) return;
      
      const isLiked = likedPhotoIds.has(photoId);
      const newLikedIds = new Set(likedPhotoIds);
      
      if (isLiked) {
          newLikedIds.delete(photoId);
      } else {
          newLikedIds.add(photoId);
      }
      setLikedPhotoIds(newLikedIds);
      
      localStorage.setItem(`album_likes_${activeEvent.id}`, JSON.stringify(Array.from(newLikedIds)));

      const updatedPhotos = activeEvent.photos.map(p => {
          if (p.id === photoId) {
              const newCount = Math.max(0, p.likes + (isLiked ? -1 : 1));
              return { ...p, likes: newCount, likedByMe: false }; 
          }
          return p;
      });
      
      await saveEventToFirebase({ ...activeEvent, photos: updatedPhotos });
  };

  const handleReport = (photoId: string) => {
     alert("Foto reportada. El administrador la revisará.");
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!currentEventId) return;
    const eventBeforeUpdate = events.find(e => e.id === currentEventId);
    if (!eventBeforeUpdate) return;
    
    const optimisticallyUpdatedPhotos = eventBeforeUpdate.photos.map(p =>
      p.id === photoId ? { ...p, isDeleted: true } : p
    );
    const optimisticEvent = { ...eventBeforeUpdate, photos: optimisticallyUpdatedPhotos };
    setEvents(events.map(e => e.id === currentEventId ? optimisticEvent : e));
    
    try {
      const latestEvent = await getEvent(currentEventId); 
      if (latestEvent) {
           const updatedPhotos = latestEvent.photos.map(p => 
                p.id === photoId ? { ...p, isDeleted: true } : p
           );
           await updateEventFieldInFirebase(currentEventId, 'photos', updatedPhotos);
      }
    } catch (error: any) {
      console.error("Error during soft delete:", error);
      alert(`Hubo un error al mover la foto a la papelera: ${error.message}`);
      setEvents(events.map(e => e.id === currentEventId ? eventBeforeUpdate : e));
    }
  };

  const handleBulkRestore = (photoIds: string[]) => {
      let updatedParticipants = [...(activeEvent.participants || [])];
      
      const photosToRestore = activeEvent.photos.filter(p => photoIds.includes(p.id));
      
      photosToRestore.forEach(photo => {
          const participantId = photo.deviceId || `legacy-${photo.author.name.replace(/\s+/g, '-').toLowerCase()}`;
          const pIndex = updatedParticipants.findIndex(p => p.id === participantId || p.name === photo.author.name);
          
          if (pIndex !== -1 && updatedParticipants[pIndex].status === 'declined') {
              updatedParticipants[pIndex] = { 
                  ...updatedParticipants[pIndex], 
                  status: 'confirmed' 
              };
          }
      });

      const updatedPhotos = activeEvent.photos.map(p => 
          photoIds.includes(p.id) 
            ? { ...p, isDeleted: false, isArchived: false } 
            : p
      );
      
      handleUpdateEvent({ 
          ...activeEvent, 
          photos: updatedPhotos,
          participants: updatedParticipants
      });
  };

  const handleRestorePhoto = (photoId: string) => {
      handleBulkRestore([photoId]);
  };

  const handlePermanentPhotoRemoval = async (photoIdsToRemove: string[]) => {
    if (!currentEventId || photoIdsToRemove.length === 0) {
      return;
    }

    setIsProcessing(true);
    try {
      const latestEvent = await getEvent(currentEventId);
      if (!latestEvent) throw new Error("No se pudo sincronizar con el evento.");

      const idsSet = new Set(photoIdsToRemove);
      const photosToDelete = latestEvent.photos.filter(p => idsSet.has(p.id));
      const urlsToDelete = photosToDelete.map(p => p.url).filter(Boolean);

      const CHUNK_SIZE = 3; 
      for (let i = 0; i < urlsToDelete.length; i += CHUNK_SIZE) {
          const chunk = urlsToDelete.slice(i, i + CHUNK_SIZE);
          await Promise.allSettled(chunk.map(url => deleteFileFromFirebase(url)));
          await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const updatedPhotos = latestEvent.photos.filter(p => !idsSet.has(p.id));
      await updateEventFieldInFirebase(currentEventId, 'photos', updatedPhotos);

      setEvents(prevEvents => prevEvents.map(e => {
          if (e.id === currentEventId) {
              return { ...e, photos: updatedPhotos };
          }
          return e;
      }));
      
      alert(`Operación completada. Se eliminaron ${photoIdsToRemove.length} elementos permanentemente.`);

    } catch (error: any) {
      console.error("Error en la eliminación permanente:", error);
      if (error.message.includes("Permiso denegado") || error.code === 'storage/unauthorized' || error.code === 'permission-denied') {
          alert("ERROR DE PERMISOS: Firebase bloqueó la eliminación.");
      } else {
          alert(`Hubo un error al eliminar los archivos: ${error.message}`);
      }
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPermanentDelete = (ids: string[]) => {
    return handlePermanentPhotoRemoval(ids);
  };

  const handlePermanentDelete = (photoId: string) => {
    return handlePermanentPhotoRemoval([photoId]);
  };
  
  const handleArchivePhoto = (photoId: string) => {
      const updatedPhotos = activeEvent.photos.map(p => 
          p.id === photoId ? { ...p, isArchived: !p.isArchived } : p
      );
      handleUpdateEvent({ ...activeEvent, photos: updatedPhotos });
  };

  const handleBulkDelete = async (photoIds: string[]) => {
    if (!currentEventId) return;
    const idsSet = new Set(photoIds);

    const eventBeforeUpdate = events.find(e => e.id === currentEventId);
    if (!eventBeforeUpdate) return;

    const optimisticallyUpdatedPhotos = eventBeforeUpdate.photos.map(p =>
      idsSet.has(p.id) ? { ...p, isDeleted: true } : p
    );
    const optimisticEvent = { ...eventBeforeUpdate, photos: optimisticallyUpdatedPhotos };
    setEvents(events.map(e => e.id === currentEventId ? optimisticEvent : e));

    try {
      const latestEvent = await getEvent(currentEventId);
      if (latestEvent) {
          const updatedPhotos = latestEvent.photos.map(p =>
            idsSet.has(p.id) ? { ...p, isDeleted: true } : p
          );
          await updateEventFieldInFirebase(currentEventId, 'photos', updatedPhotos);
      }
    } catch (error) {
      console.error("Error during bulk soft delete:", error);
      alert("Hubo un error al mover las fotos a la papelera.");
      setEvents(events.map(e => e.id === currentEventId ? eventBeforeUpdate : e));
    }
  };

  const handleBulkArchive = (photoIds: string[], shouldArchive: boolean) => {
      const updatedPhotos = activeEvent.photos.map(p => 
          photoIds.includes(p.id) ? { ...p, isArchived: shouldArchive } : p
      );
      handleUpdateEvent({ ...activeEvent, photos: updatedPhotos });
  };

  // --- SELECTION & DOWNLOAD LOGIC ---
  const handleEnableSelectionMode = () => {
      setIsDownloadSelectionMode(true);
      setDownloadSelection(new Set());
      setIsDownloadModalOpen(false); // Close download modal to show gallery
  };

  const toggleDownloadSelection = (id: string) => {
      const newSet = new Set(downloadSelection);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setDownloadSelection(newSet);
  };

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
                  // Bypass Cache: Append timestamp to URL to avoid CORS cached response
                  const fetchUrl = `${photo.url}${photo.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
                  
                  const response = await fetch(fetchUrl, { 
                      mode: 'cors', // Critical for the fix you applied in Cloud Shell
                      credentials: 'omit', 
                      cache: 'no-store' 
                  });
                  if (!response.ok) throw new Error("Fetch failed");
                  
                  const blob = await response.blob();
                  const ext = photo.type === 'video' ? 'mp4' : 'jpg';
                  const filename = `${(photo.title || 'foto').replace(/[^a-z0-9]/gi, '_')}_${photo.id.slice(-4)}.${ext}`;
                  folder?.file(filename, blob);
              } catch (err) {
                  console.warn("Failed to download photo for zip:", photo.id, err);
                  failedCount++;
              }
              // Small delay to prevent network congestion
              await new Promise(r => setTimeout(r, 100));
          }

          if (failedCount === photosToDownload.length) {
              alert("Error: No se pudieron descargar los archivos. Es posible que debas configurar el CORS en tu bucket de Firebase Storage.");
          } else {
              const content = await zip.generateAsync({ type: "blob" });
              saveAs(content, "seleccion_recuerdos.zip");
          }
      } catch (error) {
          console.error("Zip generation error:", error);
          alert("Error generando el archivo ZIP.");
      } finally {
          setIsZippingSelected(false);
          setIsDownloadSelectionMode(false);
          setDownloadSelection(new Set());
      }
  };

  // --- RENDER ---
  const theme = activeEvent.theme || DEFAULT_EVENT_TEMPLATE.theme!;
  const fontClass = theme.fontFamily === 'serif' ? 'font-serif' : 'font-sans';
  
  const hexToRgba = (hex: string, alpha: number) => {
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      c = hex.substring(1).split('');
      if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      c = '0x' + c.join('');
      return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
  };

  if (isLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
              <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
              <p className="text-gray-500">Conectando con el Álbum...</p>
          </div>
      );
  }

  if (isAdminMode) {
    return (
      <AdminPanel 
        events={events}
        currentEventId={activeEvent.id}
        currentEventPhotos={photos} 
        isProcessing={isProcessing}
        onUpdateEvent={handleUpdateEvent}
        onUpdateField={handleUpdateEventField}
        onCreateEvent={handleCreateEvent}
        onSelectEvent={setCurrentEventId}
        onDeleteEvent={handleDeleteEvent}
        onDeletePhoto={handleDeletePhoto}
        onRestorePhoto={handleRestorePhoto}
        onPermanentDelete={handlePermanentDelete}
        onArchivePhoto={handleArchivePhoto}
        onBulkDelete={handleBulkDelete}
        onBulkArchive={handleBulkArchive}
        onBulkRestore={handleBulkRestore}
        onBulkPermanentDelete={handleBulkPermanentDelete}
        onDriveImport={handleDriveImport}
        onExit={() => setIsAdminMode(false)} 
      />
    );
  }
  
  // Calculate dynamic position
  const mobilePos = theme.coverImagePositionY || 50;
  const desktopPos = theme.coverImagePositionDesktopY ?? mobilePos;

  return (
    <div 
        className={`min-h-screen pb-8 relative font-sans transition-colors duration-500 ${fontClass} select-none`}
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
      
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLoginModal(false)} />
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 relative z-10 animate-fade-in-up">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600"><Lock size={32} /></div>
              <h2 className="text-2xl font-bold text-gray-800">Acceso Admin</h2>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if(passwordInput === 'admin') { setIsAdminMode(true); setShowLoginModal(false); } else { setLoginError(true); }}}>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setLoginError(false); }}
                placeholder="Contraseña (admin)"
                className={`w-full px-4 py-3 rounded-lg border ${loginError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50'} outline-none focus:ring-2 mb-4 text-center`}
                autoFocus
              />
              <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg">Entrar</button>
            </form>
          </div>
        </div>
      )}

      {/* SELECTION MODE STICKY HEADER/BAR */}
      {isDownloadSelectionMode && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-xl p-4 animate-slide-up">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <button 
                          onClick={() => { setIsDownloadSelectionMode(false); setDownloadSelection(new Set()); }}
                          className="text-gray-500 font-medium hover:text-gray-800 transition-colors"
                      >
                          Cancelar
                      </button>
                      <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                          {downloadSelection.size} seleccionados
                      </span>
                  </div>
                  <button 
                      onClick={handleDownloadSelectedFiles}
                      disabled={downloadSelection.size === 0 || isZippingSelected}
                      className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isZippingSelected ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                      {isZippingSelected ? 'Procesando...' : `Descargar (${downloadSelection.size})`}
                  </button>
              </div>
          </div>
      )}

      <div className="relative mb-8 group overflow-hidden">
        {activeEvent.coverImage && (
            <div className="absolute inset-0 z-0 overflow-hidden h-full w-full">
                 <img 
                    src={activeEvent.coverImage} 
                    className="w-full h-full object-cover transition-all duration-500 custom-cover-position" 
                    alt="Cover" 
                    style={{ 
                        filter: `blur(${theme.coverBlur || 0}px)` 
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                 />
            </div>
        )}
        
        <div 
            className="absolute inset-0 z-0 transition-colors duration-500" 
            style={{ backgroundColor: hexToRgba(theme.coverOverlayColor || '#000000', theme.coverOverlayOpacity ?? 0.4) }}
        />

        <header className={`relative z-10 max-w-6xl mx-auto animate-fade-in ${activeEvent.coverImage ? 'py-12 px-4 md:px-8' : 'pt-8 px-4 md:px-8'}`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
                
                {theme.avatarImage ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-sm shrink-0">
                        <img src={theme.avatarImage} alt="Logo" className="w-full h-full object-cover pointer-events-none" />
                    </div>
                ) : (
                    <div 
                        className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shadow-sm shrink-0 uppercase border-2 border-white/20"
                        style={{ 
                            backgroundColor: theme.avatarBackgroundColor || '#374151', 
                            color: theme.avatarTextColor || '#ffffff' 
                        }}
                    >
                        {activeEvent.title.substring(0, 2)}
                    </div>
                )}
                
                <div>
                <h1 
                    onClick={handleTitleClick}
                    className="text-2xl md:text-3xl font-bold cursor-default select-none active:opacity-80 transition-opacity" 
                    style={{ color: theme.headerTitleColor || theme.textColor }}
                    title=" " // Hide tooltip
                >
                    {activeEvent.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm mt-1">
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
                <div className="flex items-center gap-6 mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: theme.statsTextColor || theme.textColor }}>
                    <div className="flex flex-col items-center">
                        <span className="text-lg leading-none">{guestPhotos.length}</span>
                        <span>Fotos</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-lg leading-none">{guestPhotos.reduce((acc, curr) => acc + curr.likes, 0)}</span>
                        <span>Likes</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-lg leading-none">{activeParticipants.length}</span>
                        <span>Participantes</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-lg leading-none">{remainingSpotsDisplay}</span>
                        <span>Restantes</span>
                    </div>
                </div>
                </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
                {activeEvent.allowUploads && (
                <button onClick={() => setIsUploadModalOpen(true)} style={{ backgroundColor: theme.primaryColor, color: theme.primaryTextColor }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-medium shadow-md transition-all hover:opacity-90">
                    <Camera size={18} /> Subir
                </button>
                )}
                <button onClick={() => setIsDownloadModalOpen(true)} style={{ backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-medium shadow-md transition-all hover:opacity-90">
                <Download size={18} /> Descargar
                </button>
            </div>
            </div>
        </header>
      </div>

      {guestPhotos.length > 0 && (
        <div className="max-w-6xl mx-auto mb-6 px-4 md:px-8">
            <div 
                className="rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-gray-100"
                style={{ 
                    backgroundColor: theme.galleryToolbarBg || '#ffffff',
                    color: theme.galleryToolbarText || '#374151'
                }}
            >
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <span className="font-bold flex items-center gap-2"><LayoutGrid size={20} /> Vista de Galería</span>
                {/* Ocultar en móvil si no es modo selección */}
                <div className={`hidden md:flex gap-2 ml-auto sm:ml-4 ${isDownloadSelectionMode ? 'opacity-50 pointer-events-none' : ''}`}>
                    <button onClick={() => setColumns(1)} className={`px-4 py-1.5 rounded-md border text-sm font-medium ${columns === 1 ? 'shadow-sm' : 'bg-transparent border-current opacity-70'}`} style={columns === 1 ? { backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor, borderColor: theme.secondaryColor } : {}}><LayoutList size={16} /></button>
                    <button onClick={() => setColumns(2)} className={`px-4 py-1.5 rounded-md border text-sm font-medium ${columns === 2 ? 'shadow-sm' : 'bg-transparent border-current opacity-70'}`} style={columns === 2 ? { backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor, borderColor: theme.secondaryColor } : {}}><LayoutGrid size={16} /></button>
                </div>
            </div>
            </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 md:px-8">
        {guestPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl" style={{ borderColor: hexToRgba(theme.textColor, 0.2) }}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: hexToRgba(theme.primaryColor, 0.1) }}>
                    <ImageIcon size={48} style={{ color: theme.primaryColor }} />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: theme.textColor }}>Aún no hay recuerdos aquí</h3>
                <p className="text-lg opacity-70 max-w-md mb-8" style={{ color: theme.textColor }}>Sé el primero en compartir un momento especial.</p>
                {activeEvent.allowUploads && (
                    <button onClick={() => setIsUploadModalOpen(true)} className="flex items-center gap-2 px-8 py-4 rounded-full font-bold shadow-lg hover:scale-105 transition-all" style={{ backgroundColor: theme.primaryColor, color: theme.primaryTextColor }}>
                        <Plus size={20} /> Subir
                    </button>
                )}
            </div>
        ) : (
            <>
                {/* FORZAR 1 COLUMNA EN MÓVIL (grid-cols-1), 2 EN MD+ (md:grid-cols-2) SI columns=2 */}
                <div className={`grid gap-6 ${columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                {visiblePhotos.map((photo, index) => (
                    <div 
                        key={photo.id} 
                        className={`rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border ${isDownloadSelectionMode && downloadSelection.has(photo.id) ? 'border-4 border-blue-500 ring-4 ring-blue-100 scale-[0.98]' : 'border-gray-100'}`}
                        style={{ 
                            backgroundColor: theme.cardBackgroundColor || '#ffffff' 
                        }}
                    >
                    <div className="p-4 flex items-start justify-between">
                        <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: photo.author.avatarColor, color: '#fff' }}>{photo.author.initials}</div>
                        <div>
                            <h3 className="font-bold text-base" style={{ color: theme.cardTextColor || '#1f2937' }}>{photo.author.name}</h3>
                            <p className="text-xs font-medium opacity-90" style={{ color: theme.cardTextColor || '#6b7280' }}>
                            {!isNaN(new Date(photo.createdAt).getTime()) 
                                    ? new Date(photo.createdAt).toLocaleString() 
                                    : photo.createdAt}
                            </p>
                        </div>
                        </div>
                        <button onClick={() => handleReport(photo.id)} className="hover:text-red-500 opacity-50 hover:opacity-100" style={{ color: theme.cardTextColor }}><Flag size={18} /></button>
                    </div>
                    <div 
                        className="cursor-pointer bg-gray-100 relative aspect-[4/3] overflow-hidden group" 
                        onClick={() => {
                            if (isDownloadSelectionMode) {
                                toggleDownloadSelection(photo.id);
                            } else {
                                setSelectedPhotoIndex(index);
                            }
                        }}
                    >
                        {isDownloadSelectionMode && (
                            <div className={`absolute inset-0 z-20 transition-colors flex items-center justify-center ${downloadSelection.has(photo.id) ? 'bg-blue-500/20' : 'bg-black/0 group-hover:bg-black/10'}`}>
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg transition-all transform ${downloadSelection.has(photo.id) ? 'bg-blue-500 border-blue-500 scale-110' : 'bg-white border-gray-300 scale-100'}`}>
                                    {downloadSelection.has(photo.id) && <Check size={18} className="text-white" strokeWidth={3} />}
                                </div>
                            </div>
                        )}

                        {photo.type === 'video' ? (
                            <div className="w-full h-full relative">
                                <video src={photo.thumbnail} className="w-full h-full object-cover opacity-90 pointer-events-none" muted />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Video size={32} className="text-white" /></div>
                            </div>
                        ) : (
                            <img src={photo.thumbnail} alt={photo.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
                        )}
                        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded uppercase font-bold">{photo.category}</div>
                    </div>
                    <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: hexToRgba(theme.cardTextColor || '#000000', 0.1) }}>
                        <button 
                            onClick={() => handleLike(photo.id)} 
                            className={`flex items-center gap-2 text-sm font-medium`} 
                            style={{ color: photo.likedByMe ? theme.secondaryColor : (theme.cardTextColor || '#6b7280') }}
                        >
                            <Heart size={20} className={photo.likedByMe ? "fill-current" : ""} />
                            <span>{photo.likes}</span>
                        </button>
                    </div>
                    </div>
                ))}
                </div>

                {/* PAGINATION LOAD MORE BUTTON */}
                {visiblePhotosCount < guestPhotos.length && (
                    <div className="flex justify-center mt-10 mb-6">
                        <button 
                            onClick={handleLoadMore}
                            className="flex items-center gap-2 px-8 py-3 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 hover:text-gray-900 transition-all transform hover:scale-105"
                        >
                            <ChevronDown size={20} />
                            Cargar más recuerdos ({guestPhotos.length - visiblePhotosCount} restantes)
                        </button>
                    </div>
                )}
            </>
        )}
      </main>

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
    </div>
  );
}