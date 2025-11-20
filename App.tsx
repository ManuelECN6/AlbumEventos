
import React, { useState, useEffect, useMemo } from 'react';
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
  Lock
} from 'lucide-react';

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
    allowedMediaTypes: ['photo'],
    storageLimit: 100,
    maxPhotosPerPerson: 25,
    maxVideosPerPerson: 5,
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
      coverImagePositionY: 50
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
  }, [currentEventId]);

  const activeEvent = useMemo(() => 
    events.find(e => e.id === currentEventId) || events[0] || DEFAULT_EVENT_TEMPLATE
  , [events, currentEventId]);

  // --- SYNC PARTICIPANTS FROM PHOTOS (BACKFILL) ---
  // Este efecto asegura que si hay fotos subidas, el autor aparezca en la lista de participantes
  useEffect(() => {
      if (!activeEvent || !activeEvent.photos) return;

      const currentParticipants = activeEvent.participants || [];
      const participantIds = new Set(currentParticipants.map(p => p.id));
      let hasChanges = false;
      const updatedParticipants = [...currentParticipants];

      // Solo consideramos fotos que NO están en la papelera (deleted)
      const activePhotos = activeEvent.photos.filter(p => !p.isDeleted);

      activePhotos.forEach(photo => {
          // Identificar usuario por DeviceID o fallback al nombre (para fotos legacy)
          const userId = photo.deviceId || `legacy-${photo.author.name.replace(/\s+/g, '-').toLowerCase()}`;
          
          if (!participantIds.has(userId)) {
              // Verificamos si ya lo añadimos en este ciclo para evitar duplicados
              if (!updatedParticipants.find(p => p.id === userId)) {
                  updatedParticipants.push({
                      id: userId,
                      name: photo.author.name,
                      status: 'confirmed',
                      addedAt: photo.createdAt.split(' ')[0] || new Date().toISOString().split('T')[0]
                  });
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

  // Filter active participants (exclude deleted/trash)
  const activeParticipants = useMemo(() => 
    (activeEvent.participants || []).filter(p => p.status === 'confirmed'), 
  [activeEvent.participants]);

  // STATS CALCULATIONS
  const uniqueContributors = useMemo(() => {
      const uniqueUsers = new Set();
      // Count contributors based on NON-DELETED photos
      const validPhotos = photos.filter(p => !p.isDeleted);
      validPhotos.forEach(photo => {
          // Use deviceId if available, otherwise fallback to author name
          if (photo.deviceId) {
              uniqueUsers.add(photo.deviceId);
          } else {
              uniqueUsers.add(photo.author.name);
          }
      });
      return uniqueUsers.size;
  }, [photos]);

  const remainingSpotsDisplay = useMemo(() => {
      const totalCapacity = activeEvent.participantsCount || 0;
      // Usamos la lista filtrada de participantes activos
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
    // Guardar en Firebase
    await saveEventToFirebase(newEvent);
    setCurrentEventId(id);
  };

  const handleUpdateEvent = async (updatedEvent: EventConfig) => {
    // Guardar en Firebase
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
      alert("No puedes eliminar el último evento.");
      return;
    }
    if (confirm("¿Estás seguro? Se borrará este álbum de la base de datos.")) {
        await deleteEventFromFirebase(id);
        if (currentEventId === id) setCurrentEventId(null);
    }
  };

  // SUBIDA DE FOTOS (CONECTADA A FIREBASE STORAGE)
  const handlePhotoUpload = async (files: File[], authorName: string) => {
    const newPhotos: Photo[] = [];
    
    // Usar el color primario del tema o uno por defecto
    const authorColor = activeEvent.theme?.primaryColor || '#a87b51';

    // Procesar archivos uno por uno (para mantener orden y simplicidad)
    for (const file of files) {
        try {
            // Subir a Firebase Storage y obtener URL y metadatos
            const photoObject = await processAndUploadPhoto(
                file, 
                activeEvent.id, 
                authorName, 
                authorColor,
                deviceId // Pasar el ID del dispositivo
            );
            newPhotos.push(photoObject);
        } catch (error) {
            console.error("Error subiendo archivo:", file.name, error);
        }
    }

    if (newPhotos.length > 0) {
        // --- NUEVA LÓGICA: ACTUALIZAR LISTA DE PARTICIPANTES AL SUBIR ---
        let currentParticipants = [...(activeEvent.participants || [])];
        const userId = deviceId || `legacy-${authorName.replace(/\s+/g, '-').toLowerCase()}`;

        // Verificar si este dispositivo ya está registrado como participante
        const participantIndex = currentParticipants.findIndex(p => p.id === userId);

        if (participantIndex === -1) {
            // Si no existe, lo creamos
            const newParticipant: Participant = {
                id: userId, 
                name: authorName,
                status: 'confirmed', // Confirmado porque ya subió fotos
                addedAt: new Date().toISOString().split('T')[0]
            };
            currentParticipants.push(newParticipant);
        } else {
             // Opcional: Actualizar nombre si cambió
             // Si estaba "declined" (eliminado), lo reactivamos al subir nuevas fotos
             if(currentParticipants[participantIndex].status === 'declined') {
                 currentParticipants[participantIndex] = {
                     ...currentParticipants[participantIndex],
                     status: 'confirmed',
                     name: authorName
                 };
             } else {
                 currentParticipants[participantIndex] = {
                     ...currentParticipants[participantIndex],
                     name: authorName
                 };
             }
        }

        // Actualizar el evento en Firebase con las nuevas fotos Y la nueva lista de participantes
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

        // 1. Process and upload all files to Firebase Storage
        for (const file of files) {
            try {
                // Use a stable device ID for the admin importer to group all imports
                const importerDeviceId = `drive-importer-${activeEvent.id}`;
                const photoObject = await processAndUploadPhoto(file, activeEvent.id, authorName, authorColor, importerDeviceId);
                newPhotos.push(photoObject);
            } catch (error) {
                console.error(`Error processing Drive file ${file.name}:`, error);
            }
        }

        if (newPhotos.length > 0) {
            // 2. Get the latest event state to avoid overwriting data
            const latestEvent = await getEvent(activeEvent.id);
            if (!latestEvent) throw new Error("Event not found for Drive import.");

            let updatedParticipants = [...(latestEvent.participants || [])];
            const importerDeviceId = `drive-importer-${latestEvent.id}`;

            // 3. Find or create a participant entry for the importer
            let importerParticipant = updatedParticipants.find(p => p.id === importerDeviceId);
            if (!importerParticipant) {
                importerParticipant = {
                    id: importerDeviceId,
                    name: authorName,
                    status: 'confirmed',
                    addedAt: new Date().toISOString().split('T')[0],
                };
                updatedParticipants.push(importerParticipant);
            }

            // 4. Combine new photos with existing ones and save
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
      
      // 1. Actualizar estado local (Toggle)
      if (isLiked) {
          newLikedIds.delete(photoId);
      } else {
          newLikedIds.add(photoId);
      }
      setLikedPhotoIds(newLikedIds);
      
      // 2. Guardar persistencia local
      localStorage.setItem(`album_likes_${activeEvent.id}`, JSON.stringify(Array.from(newLikedIds)));

      // 3. Actualizar Firebase (Solo contador)
      const updatedPhotos = activeEvent.photos.map(p => {
          if (p.id === photoId) {
              // Calcular nuevo contador
              const newCount = Math.max(0, p.likes + (isLiked ? -1 : 1));
              // IMPORTANTE: No guardamos 'likedByMe' en la base de datos compartida para no afectar a otros usuarios
              return { ...p, likes: newCount, likedByMe: false }; 
          }
          return p;
      });
      
      await saveEventToFirebase({ ...activeEvent, photos: updatedPhotos });
  };

  const handleReport = (photoId: string) => {
     // En una app real, esto enviaría una alerta a una colección 'reports'
     alert("Foto reportada. El administrador la revisará.");
  };

  // Soft Delete (Move to Recycle Bin) - WITH OPTIMISTIC UPDATE
  const handleDeletePhoto = async (photoId: string) => {
    if (!currentEventId) return;

    // Optimistic UI Update
    const eventBeforeUpdate = events.find(e => e.id === currentEventId);
    if (!eventBeforeUpdate) return;
    
    const optimisticallyUpdatedPhotos = eventBeforeUpdate.photos.map(p =>
      p.id === photoId ? { ...p, isDeleted: true } : p
    );
    const optimisticEvent = { ...eventBeforeUpdate, photos: optimisticallyUpdatedPhotos };
    setEvents(events.map(e => e.id === currentEventId ? optimisticEvent : e));
    
    // Perform actual DB operation directly
    try {
      // We rely on the optimistic update. In a real app with heavy concurrency,
      // we might want to fetch fresh data, but for soft delete, updating based on current state is acceptable
      // to ensure the UI feels snappy. The next subscription update will sync truth.
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
      // Revert on failure
      setEvents(events.map(e => e.id === currentEventId ? eventBeforeUpdate : e));
    }
  };

  // Bulk Restore Photos (And Participants)
  const handleBulkRestore = (photoIds: string[]) => {
      let updatedParticipants = [...(activeEvent.participants || [])];
      
      // Find photos to be restored
      const photosToRestore = activeEvent.photos.filter(p => photoIds.includes(p.id));
      
      // Check associated participants and restore them if they are deleted
      photosToRestore.forEach(photo => {
          const participantId = photo.deviceId || `legacy-${photo.author.name.replace(/\s+/g, '-').toLowerCase()}`;
          const pIndex = updatedParticipants.findIndex(p => p.id === participantId);
          
          // If the participant is in the trash (declined), bring them back to active (confirmed)
          if (pIndex !== -1 && updatedParticipants[pIndex].status === 'declined') {
              updatedParticipants[pIndex] = { 
                  ...updatedParticipants[pIndex], 
                  status: 'confirmed' 
              };
          }
      });

      // Restore photos
      // CRITICAL: Ensure isDeleted is false AND isArchived is false so it appears in the album immediately
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

  // Restore from Recycle Bin (Single Wrapper)
  const handleRestorePhoto = (photoId: string) => {
      handleBulkRestore([photoId]);
  };

  // --- LÓGICA DE ELIMINACIÓN RE-ARQUITECTADA ---

  // NÚCLEO CENTRAL DE ELIMINACIÓN PERMANENTE:
  // Esta es la única función que borra archivos de Storage y actualiza la DB.
  const handlePermanentPhotoRemoval = async (photoIdsToRemove: string[]) => {
    if (!currentEventId || photoIdsToRemove.length === 0) {
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Obtener la versión más reciente del evento desde la base de datos.
      const latestEvent = await getEvent(currentEventId);
      if (!latestEvent) throw new Error("No se pudo sincronizar con el evento.");

      const idsSet = new Set(photoIdsToRemove);
      
      // 2. Identificar los archivos que realmente existen en la versión más reciente.
      const photosToDelete = latestEvent.photos.filter(p => idsSet.has(p.id));
      const urlsToDelete = photosToDelete.map(p => p.url).filter(Boolean);

      // 3. Intentar borrar todos los archivos de Firebase Storage.
      // IMPORTANTE: Lo hacemos en lotes (batches) para no saturar la conexión y asegurar que se borren.
      // Si intentamos borrar 100 fotos de golpe, Firebase/Navegador puede bloquear las peticiones.
      const CHUNK_SIZE = 3; 
      const permissionErrors: any[] = [];

      for (let i = 0; i < urlsToDelete.length; i += CHUNK_SIZE) {
          const chunk = urlsToDelete.slice(i, i + CHUNK_SIZE);
          // Esperamos a que termine este lote antes de seguir
          const results = await Promise.allSettled(chunk.map(url => deleteFileFromFirebase(url)));
          
          // Recolectar errores de permisos
          results.forEach(r => {
              if (r.status === 'rejected' && (r.reason?.code === 'storage/unauthorized' || r.reason?.message?.includes('unauthorized'))) {
                  permissionErrors.push(r.reason);
              }
          });

          // Pequeña pausa para no ahogar el hilo principal
          await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (permissionErrors.length > 0) {
          // Si hubo errores de permisos, lanzamos uno para avisar, pero después de intentar borrar todo lo posible
          throw new Error("Permiso denegado por Firebase Storage. Asegúrate de que las reglas permiten borrar.");
      }

      // 4. Actualizar la base de datos con la lista limpia.
      const updatedPhotos = latestEvent.photos.filter(p => !idsSet.has(p.id));
      
      await updateEventFieldInFirebase(currentEventId, 'photos', updatedPhotos);

      // --- FIX: ACTUALIZACIÓN LOCAL INMEDIATA (OPTIMISTIC UPDATE FORZADO) ---
      // Esto garantiza que la UI refleje el cambio visualmente al instante, 
      // aunque la suscripción de Firebase tarde unos milisegundos en dispararse.
      setEvents(prevEvents => prevEvents.map(e => {
          if (e.id === currentEventId) {
              return { ...e, photos: updatedPhotos };
          }
          return e;
      }));
      
      // ALERT DE ÉXITO: Para confirmar al usuario que la operación terminó
      alert(`Operación completada. Se eliminaron ${photoIdsToRemove.length} elementos permanentemente.`);

    } catch (error: any) {
      console.error("Error en la eliminación permanente:", error);
      
      if (error.message.includes("Permiso denegado") || error.code === 'storage/unauthorized' || error.code === 'permission-denied') {
          alert("ERROR DE PERMISOS: Firebase bloqueó la eliminación. \n\nSolución: Ve a Firebase Console > Storage > Rules y cambia a 'allow read, write: if true;'");
      } else {
          alert(`Hubo un error al eliminar los archivos: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Wrapper para eliminar una selección. Pasa los IDs directamente al núcleo.
  const handleBulkPermanentDelete = (ids: string[]) => {
    return handlePermanentPhotoRemoval(ids);
  };

  // Wrapper para eliminar una sola foto de forma permanente.
  const handlePermanentDelete = (photoId: string) => {
    handlePermanentPhotoRemoval([photoId]);
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

    // Optimistic UI Update
    const eventBeforeUpdate = events.find(e => e.id === currentEventId);
    if (!eventBeforeUpdate) return;

    const optimisticallyUpdatedPhotos = eventBeforeUpdate.photos.map(p =>
      idsSet.has(p.id) ? { ...p, isDeleted: true } : p
    );
    const optimisticEvent = { ...eventBeforeUpdate, photos: optimisticallyUpdatedPhotos };
    setEvents(events.map(e => e.id === currentEventId ? optimisticEvent : e));

    // Perform actual DB operation
    try {
      const latestEvent = await getEvent(currentEventId);
      if (!latestEvent) throw new Error("Event not found for bulk delete");

      const updatedPhotos = latestEvent.photos.map(p =>
        idsSet.has(p.id) ? { ...p, isDeleted: true } : p
      );
      await updateEventFieldInFirebase(currentEventId, 'photos', updatedPhotos);
    } catch (error) {
      console.error("Error during bulk soft delete:", error);
      alert("Hubo un error al mover las fotos a la papelera.");
      // Revert on failure
      setEvents(events.map(e => e.id === currentEventId ? eventBeforeUpdate : e));
    }
  };

  const handleBulkArchive = (photoIds: string[], shouldArchive: boolean) => {
      const updatedPhotos = activeEvent.photos.map(p => 
          photoIds.includes(p.id) ? { ...p, isArchived: shouldArchive } : p
      );
      handleUpdateEvent({ ...activeEvent, photos: updatedPhotos });
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
        isProcessing={isProcessing} // Pasamos el estado de carga
        onUpdateEvent={handleUpdateEvent}
        onUpdateField={handleUpdateEventField} // Pass the new handler for atomic updates
        onCreateEvent={handleCreateEvent}
        onSelectEvent={setCurrentEventId}
        onDeleteEvent={handleDeleteEvent}
        onDeletePhoto={handleDeletePhoto} // Soft delete
        onRestorePhoto={handleRestorePhoto} // Restore Single
        onPermanentDelete={handlePermanentDelete} // Hard delete
        onArchivePhoto={handleArchivePhoto}
        onBulkDelete={handleBulkDelete}
        onBulkArchive={handleBulkArchive}
        onBulkRestore={handleBulkRestore} // Restore Bulk (New)
        onBulkPermanentDelete={handleBulkPermanentDelete} // Pass the robust handler
        onDriveImport={handleDriveImport}
        onExit={() => setIsAdminMode(false)} 
      />
    );
  }

  return (
    <div 
        className={`min-h-screen pb-8 relative font-sans transition-colors duration-500 ${fontClass}`}
        style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {/* Admin Toggle */}
      <button 
        onClick={() => setShowLoginModal(true)}
        className="fixed bottom-6 right-6 z-40 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg text-gray-400 hover:text-gray-800 transition-all border border-gray-200 hover:scale-110"
        title="Acceso Administrador"
      >
        <Settings size={20} />
      </button>

      {/* Login Modal */}
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

      {/* Banner */}
      <div className="relative mb-8 group overflow-hidden">
        {/* Cover Image Layer */}
        {activeEvent.coverImage && (
            <div className="absolute inset-0 z-0 overflow-hidden h-full w-full">
                 <img 
                    src={activeEvent.coverImage} 
                    className="w-full h-full object-cover transition-all duration-500" 
                    alt="Cover" 
                    style={{ 
                        objectPosition: `50% ${theme.coverImagePositionY || 50}%`,
                        filter: `blur(${theme.coverBlur || 0}px)` 
                    }}
                 />
            </div>
        )}
        
        {/* Overlay Layer */}
        <div 
            className="absolute inset-0 z-0 transition-colors duration-500" 
            style={{ backgroundColor: hexToRgba(theme.coverOverlayColor || '#000000', theme.coverOverlayOpacity ?? 0.4) }}
        />

        <header className={`relative z-10 max-w-6xl mx-auto animate-fade-in ${activeEvent.coverImage ? 'py-12 px-4 md:px-8' : 'pt-8 px-4 md:px-8'}`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
                
                {/* AVATAR IDENTITY - RESPECT THEME COLORS */}
                {theme.avatarImage ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-sm shrink-0">
                        <img src={theme.avatarImage} alt="Logo" className="w-full h-full object-cover" />
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
                {/* HEADER TITLE: PRIORITIZE THEME COLOR OVER WHITE */}
                <h1 className="text-2xl md:text-3xl font-bold" style={{ color: theme.headerTitleColor || theme.textColor }}>
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
                    {/* FOTOS */}
                    <div className="flex flex-col items-center">
                        <span className="text-lg leading-none">{guestPhotos.length}</span>
                        <span>Fotos</span>
                    </div>
                    {/* LIKES */}
                    <div className="flex flex-col items-center">
                        <span className="text-lg leading-none">{guestPhotos.reduce((acc, curr) => acc + curr.likes, 0)}</span>
                        <span>Likes</span>
                    </div>
                    {/* PARTICIPANTES (Registrados) */}
                    <div className="flex flex-col items-center">
                        <span className="text-lg leading-none">{activeParticipants.length}</span>
                        <span>Participantes</span>
                    </div>
                    {/* RESTANTES (Cupos) */}
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
                    <Camera size={18} /> Subir Foto
                </button>
                )}
                <button onClick={() => setIsDownloadModalOpen(true)} style={{ backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-medium shadow-md transition-all hover:opacity-90">
                <Download size={18} /> Descargar
                </button>
            </div>
            </div>
        </header>
      </div>

      {/* View Controls */}
      {guestPhotos.length > 0 && (
        <div className="max-w-6xl mx-auto mb-6 px-4 md:px-8">
            <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-gray-100">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <span className="font-bold text-gray-700 flex items-center gap-2"><LayoutGrid size={20} /> Vista de Galería</span>
                <div className="flex gap-2 ml-auto sm:ml-4">
                <button onClick={() => setColumns(1)} className={`px-4 py-1.5 rounded-md border text-sm font-medium ${columns === 1 ? 'shadow-sm' : 'bg-white border-gray-300'}`} style={columns === 1 ? { backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor } : {}}><LayoutList size={16} /></button>
                <button onClick={() => setColumns(2)} className={`px-4 py-1.5 rounded-md border text-sm font-medium ${columns === 2 ? 'shadow-sm' : 'bg-white border-gray-300'}`} style={columns === 2 ? { backgroundColor: theme.secondaryColor, color: theme.secondaryTextColor } : {}}><LayoutGrid size={16} /></button>
                </div>
            </div>
            </div>
        </div>
      )}

      {/* Photos Grid */}
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
                        <Plus size={20} /> Subir Primer Recuerdo
                    </button>
                )}
            </div>
        ) : (
            <div className={`grid gap-6 ${columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            {guestPhotos.map((photo, index) => (
                <div key={photo.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden border border-gray-100">
                <div className="p-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-gray-700" style={{ backgroundColor: photo.author.avatarColor }}>{photo.author.initials}</div>
                    <div><h3 className="font-bold text-gray-800 text-sm">{photo.author.name}</h3><p className="text-gray-400 text-xs">{new Date(photo.createdAt).toLocaleString()}</p></div>
                    </div>
                    <button onClick={() => handleReport(photo.id)} className="text-gray-300 hover:text-red-500"><Flag size={18} /></button>
                </div>
                <div className="cursor-pointer bg-gray-100 relative aspect-[4/3] overflow-hidden" onClick={() => setSelectedPhotoIndex(index)}>
                    {photo.type === 'video' ? (
                        <div className="w-full h-full relative">
                             <video src={photo.thumbnail} className="w-full h-full object-cover opacity-90" muted />
                             <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Video size={32} className="text-white" /></div>
                        </div>
                    ) : (
                        <img src={photo.thumbnail} alt={photo.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
                    )}
                    <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded uppercase font-bold">{photo.category}</div>
                </div>
                <div className="p-4 border-t border-gray-50 flex items-center justify-between">
                    <button onClick={() => handleLike(photo.id)} className={`flex items-center gap-2 text-sm font-medium ${photo.likedByMe ? '' : 'text-gray-500'}`} style={photo.likedByMe ? { color: theme.secondaryColor } : {}}><Heart size={20} className={photo.likedByMe ? "fill-current" : ""} /><span>{photo.likes}</span></button>
                </div>
                </div>
            ))}
            </div>
        )}
      </main>

      <Lightbox 
        photo={selectedPhotoIndex !== null ? guestPhotos[selectedPhotoIndex] : null}
        isOpen={selectedPhotoIndex !== null}
        onClose={() => setSelectedPhotoIndex(null)}
        onNext={() => selectedPhotoIndex !== null && selectedPhotoIndex < guestPhotos.length - 1 && setSelectedPhotoIndex(selectedPhotoIndex + 1)}
        onPrev={() => selectedPhotoIndex !== null && selectedPhotoIndex > 0 && setSelectedPhotoIndex(selectedPhotoIndex - 1)}
        hasNext={selectedPhotoIndex !== null && selectedPhotoIndex < guestPhotos.length - 1}
        hasPrev={selectedPhotoIndex !== null && selectedPhotoIndex > 0}
        onLike={handleLike}
        onReport={handleReport}
        allPhotos={guestPhotos}
        onSelect={setSelectedPhotoIndex}
      />

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        event={activeEvent} 
        onUpload={handlePhotoUpload}
        deviceId={deviceId} // Pasar ID para validación de límites
      />
      <DownloadModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} event={activeEvent} />
    </div>
  );
}
