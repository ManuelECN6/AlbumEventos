import { db, storage } from '../firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  writeBatch,
  increment,
  arrayRemove,
  arrayUnion,
  runTransaction
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { EventConfig, Photo } from '../types';

const EVENTS_COLLECTION = 'events';

// --- NUEVO: Función auxiliar para detectar si una foto es Legacy (está en el array principal) o Moderna (Subcolección)
const getPhotoLocation = async (eventId: string, photoId: string): Promise<'subcollection' | 'legacy'> => {
    const photoRef = doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId);
    const snap = await getDoc(photoRef);
    return snap.exists() ? 'subcollection' : 'legacy';
};

/**
 * ESCUCHAR EVENTOS EN TIEMPO REAL (ADMIN)
 */
export const subscribeToEvents = (callback: (events: EventConfig[]) => void) => {
  const q = query(collection(db, EVENTS_COLLECTION), orderBy('date', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    // Nota: En la lista general de admin NO descargamos las subcolecciones de fotos 
    // para mantenerlo ligero. El admin debe entrar al detalle para ver fotos.
    const events = snapshot.docs.map(doc => {
        const data = doc.data() as EventConfig;
        // Aseguramos que photos sea un array aunque esté vacío (para evitar crash)
        return { ...data, photos: data.photos || [] };
    });
    callback(events);
  });
};

/**
 * ESCUCHAR UN SOLO EVENTO + SUS FOTOS (VISITANTE/DETALLE) - ARQUITECTURA HÍBRIDA
 * Escucha el documento principal Y la subcolección de fotos, fusionándolos.
 */
export const subscribeToVisitorEvent = (identifier: string | null, callback: (events: EventConfig[]) => void) => {
  // 1. Resolver el ID del documento
  let docQuery: any;
  
  if (!identifier) {
    docQuery = query(collection(db, EVENTS_COLLECTION), orderBy('date', 'desc'), limit(1));
  } else if (identifier.startsWith('event-') && !identifier.startsWith('evento-')) {
    docQuery = doc(db, EVENTS_COLLECTION, identifier);
  } else {
    docQuery = query(collection(db, EVENTS_COLLECTION), where('publicToken', '==', identifier), limit(1));
  }

  // Helper para manejar la suscripción a la subcolección
  let photoUnsubscribe: (() => void) | null = null;

  const handleEventDoc = (eventData: EventConfig, eventId: string) => {
      // Fotos Legacy (que viven dentro del documento principal)
      const legacyPhotos = eventData.photos || [];

      // Suscribirse a la SUBCOLECCIÓN de fotos (Nuevas)
      const photosColRef = collection(db, EVENTS_COLLECTION, eventId, 'photos');
      // Ordenamos por fecha de creación si es posible
      const qPhotos = query(photosColRef); // Puedes añadir orderBy('createdAt', 'desc') si indexas

      if (photoUnsubscribe) photoUnsubscribe();

      photoUnsubscribe = onSnapshot(qPhotos, (photoSnaps) => {
          const subcollectionPhotos = photoSnaps.docs.map(p => p.data() as Photo);
          
          // FUSIÓN: Legacy + Subcolección
          // Usamos un Map para evitar duplicados si migramos fotos de un lado a otro
          const photoMap = new Map<string, Photo>();
          
          legacyPhotos.forEach(p => photoMap.set(p.id, p));
          subcollectionPhotos.forEach(p => photoMap.set(p.id, p));

          const allPhotos = Array.from(photoMap.values()).sort((a, b) => {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          callback([{ ...eventData, id: eventId, photos: allPhotos }]);
      });
  };

  // Suscripción al Documento Principal
  const mainUnsubscribe = onSnapshot(docQuery, (snapshot: any) => {
      // Manejo si es QuerySnapshot o DocumentSnapshot
      let docSnap = null;
      if (snapshot.docs) {
          if (snapshot.empty) { callback([]); return; }
          docSnap = snapshot.docs[0];
      } else {
          if (!snapshot.exists()) { callback([]); return; }
          docSnap = snapshot;
      }

      const eventData = docSnap.data() as EventConfig;
      handleEventDoc(eventData, docSnap.id);
  });

  // Retornar función de limpieza que cierre ambas suscripciones
  return () => {
      mainUnsubscribe();
      if (photoUnsubscribe) photoUnsubscribe();
  };
};

/**
 * GUARDAR EVENTO (SIN FOTOS ARRAY)
 * Guarda la configuración. Si se pasa un array de fotos, se ELIMINA antes de guardar
 * para proteger el límite de 1MB. Las fotos deben ir por subcolección.
 */
export const saveEventToFirebase = async (event: EventConfig) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, event.id);
    
    // CLAVE: Desestructurar para separar photos del resto de la data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { photos, ...eventDataWithoutPhotos } = event;
    
    // Guardamos solo la metadata del evento.
    // merge: true preserva campos que no estemos enviando (como photos legacy si existieran, 
    // aunque idealmente no deberíamos tocarlas aquí).
    await setDoc(eventRef, eventDataWithoutPhotos, { merge: true }); 
  } catch (error) {
    console.error("Error guardando evento en Firebase:", error);
    throw error;
  }
};

/**
 * ACTUALIZACIÓN ATÓMICA DE CAMPOS
 */
export const updateEventFieldInFirebase = async (eventId: string, fieldPath: string, value: any) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    
    // Si intentan actualizar 'photos' directamente, interceptamos para evitar error de tamaño
    if (fieldPath === 'photos') {
        console.warn("Intentando actualizar 'photos' array directamente. Esto solo afecta a fotos legacy.");
        // Permitimos update si es legacy, pero lo ideal es usar las funciones atómicas de abajo
    }

    await updateDoc(eventRef, {
      [fieldPath]: value
    });
  } catch (error) {
    console.error(`Error actualizando el campo ${fieldPath}:`, error);
    throw error;
  }
};

export const deleteEventFromFirebase = async (eventId: string) => {
  try {
    await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
    // Nota: Firestore no borra subcolecciones automáticamente. 
    // Para borrar las fotos reales se requeriría una Cloud Function o borrar recursivamente desde cliente (costoso).
  } catch (error) {
    console.error("Error eliminando evento:", error);
    throw error;
  }
};

export const deleteFileFromFirebase = async (fileUrl: string) => {
  try {
    if (!fileUrl || !fileUrl.includes('firebasestorage.googleapis.com')) return;
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
  } catch (error: any) {
    if (error.code !== 'storage/object-not-found') {
        console.error("Error borrando archivo:", error);
    }
  }
};

export const uploadFileToFirebase = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const metadata = {
        cacheControl: 'public, max-age=31536000, immutable',
        contentType: file.type,
    };
    const snapshot = await uploadBytes(storageRef, file, metadata);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error("Error subiendo archivo:", error);
    throw error;
  }
};

const resizeImage = (file: File, maxWidth: number, quality: number): Promise<File> => {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let { width, height } = img;
            if (width > height) {
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
            } else {
                if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(file); return; }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                    const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    resolve(new File([blob], newName, { type: 'image/webp', lastModified: Date.now() }));
                } else {
                    resolve(file);
                }
            }, 'image/webp', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
};

/**
 * PROCESAR Y SUBIR FOTO -> AHORA GUARDA EN SUBCOLECCIÓN
 */
export const processAndUploadPhoto = async (
  file: File, 
  eventId: string, 
  authorName: string, 
  authorColor: string,
  deviceId: string
): Promise<Photo> => {
  if (!eventId) throw new Error("ID de evento requerido.");
  
  // 1. Validaciones
  const isVideo = file.type.startsWith('video/') || file.type === 'video/quicktime';
  if (isVideo && file.size > 100 * 1024 * 1024) { // 100MB Hard limit
      throw new Error("Video excede 100MB.");
  }

  const timestamp = Date.now();
  const userIdFolder = deviceId?.trim() ? deviceId : 'anonimo';
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const photoId = `photo-${timestamp}`;

  // 2. Subida a Storage (Caché + WebP)
  let mainUrl = '', thumbUrl = '';
  
  if (isVideo) {
      const path = `eventos/${eventId}/${userIdFolder}/${timestamp}_${sanitizedName}`;
      mainUrl = await uploadFileToFirebase(file, path);
      thumbUrl = mainUrl; 
  } else {
      try {
          const webpName = sanitizedName.replace(/\.[^/.]+$/, "") + ".webp";
          const mainImg = await resizeImage(file, 1920, 0.85); // WebP Calidad Alta
          mainUrl = await uploadFileToFirebase(mainImg, `eventos/${eventId}/${userIdFolder}/${timestamp}_${webpName}`);

          const thumbImg = await resizeImage(file, 500, 0.6); // WebP Miniatura
          thumbUrl = await uploadFileToFirebase(thumbImg, `eventos/${eventId}/${userIdFolder}/thumbnails/thumb_${timestamp}_${webpName}`);
      } catch (e) {
          console.warn("Fallback JPEG", e);
          mainUrl = await uploadFileToFirebase(file, `eventos/${eventId}/${userIdFolder}/${timestamp}_${sanitizedName}`);
          thumbUrl = mainUrl;
      }
  }

  // 3. Crear Objeto Foto
  const newPhoto: Photo = {
    id: photoId,
    url: mainUrl,
    thumbnail: thumbUrl,
    width: 0, height: 0,
    title: file.name,
    category: 'General',
    likes: 0,
    likedByMe: false,
    isArchived: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    author: { name: authorName, initials: authorName.substring(0, 2).toUpperCase(), avatarColor: authorColor },
    type: isVideo ? 'video' : 'photo',
    deviceId: deviceId
  };

  // 4. GUARDAR EN SUBCOLECCIÓN (La parte clave de la escalabilidad)
  // events/{eventId}/photos/{photoId}
  await setDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId), newPhoto);

  return newPhoto;
};

// --- FUNCIONES ATÓMICAS DE GESTIÓN (HÍBRIDAS) ---

export const togglePhotoLike = async (eventId: string, photoId: string, incrementVal: boolean) => {
    const loc = await getPhotoLocation(eventId, photoId);
    
    if (loc === 'subcollection') {
        const ref = doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId);
        await updateDoc(ref, { likes: increment(incrementVal ? 1 : -1) });
    } else {
        // LEGACY: Transaction para encontrar la foto en el array y actualizarla
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists()) return;
            const data = eventDoc.data() as EventConfig;
            const photos = data.photos || [];
            const idx = photos.findIndex(p => p.id === photoId);
            if (idx >= 0) {
                photos[idx].likes = Math.max(0, photos[idx].likes + (incrementVal ? 1 : -1));
                transaction.update(eventRef, { photos });
            }
        });
    }
};

export const updatePhotoField = async (eventId: string, photoId: string, field: string, value: any) => {
    const loc = await getPhotoLocation(eventId, photoId);
    
    if (loc === 'subcollection') {
        await updateDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId), { [field]: value });
    } else {
        // LEGACY
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists()) return;
            const photos = (eventDoc.data() as EventConfig).photos || [];
            const idx = photos.findIndex(p => p.id === photoId);
            if (idx >= 0) {
                photos[idx] = { ...photos[idx], [field]: value };
                transaction.update(eventRef, { photos });
            }
        });
    }
};

/**
 * Operaciones por Lote (Bulk) para AdminPanel
 * Soporta mezcla de fotos legacy y modernas.
 */
export const batchUpdatePhotos = async (eventId: string, photoIds: string[], updates: Partial<Photo>) => {
    // Para eficiencia, primero intentamos batch en subcolección.
    // Las que fallen (no existan), las tratamos como legacy.
    const batch = writeBatch(db);
    const legacyIds: string[] = [];

    // Chequeo paralelo de ubicación
    await Promise.all(photoIds.map(async (id) => {
        const ref = doc(db, EVENTS_COLLECTION, eventId, 'photos', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            batch.update(ref, updates);
        } else {
            legacyIds.push(id);
        }
    }));

    // Ejecutar batch de modernas
    await batch.commit();

    // Ejecutar legacy (si hay)
    if (legacyIds.length > 0) {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists()) return;
            
            const photos = (eventDoc.data() as EventConfig).photos || [];
            let changed = false;
            
            legacyIds.forEach(id => {
                const idx = photos.findIndex(p => p.id === id);
                if (idx >= 0) {
                    photos[idx] = { ...photos[idx], ...updates };
                    changed = true;
                }
            });

            if (changed) transaction.update(eventRef, { photos });
        });
    }
};

// Wrappers semánticos
export const softDeletePhoto = (eventId: string, photoId: string) => updatePhotoField(eventId, photoId, 'isDeleted', true);
export const restorePhoto = (eventId: string, photoId: string) => updatePhotoField(eventId, photoId, 'isDeleted', false);
export const archivePhoto = (eventId: string, photoId: string, archive: boolean) => updatePhotoField(eventId, photoId, 'isArchived', archive);

export const permanentDeletePhoto = async (eventId: string, photoId: string, photoUrl: string) => {
    // 1. Borrar archivo físico
    await deleteFileFromFirebase(photoUrl);
    
    // 2. Borrar documento (Híbrido)
    const loc = await getPhotoLocation(eventId, photoId);
    if (loc === 'subcollection') {
        await deleteDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId));
    } else {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(eventRef);
            if (!docSnap.exists()) return;
            const photos = (docSnap.data() as EventConfig).photos || [];
            const newPhotos = photos.filter(p => p.id !== photoId);
            t.update(eventRef, { photos: newPhotos });
        });
    }
};

export const getEvent = async (eventId: string): Promise<EventConfig | null> => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    const docSnap = await getDoc(eventRef);
    if (docSnap.exists()) {
      return docSnap.data() as EventConfig;
    }
    return null;
  } catch (error) {
    console.error("Error fetching event:", error);
    throw error;
  }
};
