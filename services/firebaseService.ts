import { db, storage, auth } from '../firebaseConfig';
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
  runTransaction
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes,
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  getMetadata,
  listAll
} from 'firebase/storage';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { EventConfig, Photo } from '../types';

const EVENTS_COLLECTION = 'events';

// --- AUTH SERVICES ---

export const loginAdmin = async (email: string, pass: string) => {
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (error) {
    console.error("Error en login:", error);
    throw error;
  }
};

export const logoutAdmin = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('album_admin_session'); 
  } catch (error) {
    console.error("Error en logout:", error);
  }
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

// --- FIRESTORE SERVICES ---

const getPhotoLocation = async (eventId: string, photoId: string): Promise<'subcollection' | 'legacy'> => {
    const photoRef = doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId);
    const snap = await getDoc(photoRef);
    return snap.exists() ? 'subcollection' : 'legacy';
};

export const subscribeToEvents = (callback: (events: EventConfig[]) => void) => {
  const q = query(collection(db, EVENTS_COLLECTION), orderBy('date', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(doc => {
        const data = doc.data() as EventConfig;
        return { ...data, photos: data.photos || [] };
    });
    callback(events);
  }, (error) => {
      console.error("Error suscribiendo a eventos:", error);
      callback([]); 
  });
};

/**
 * ESCUCHAR UN SOLO EVENTO + SUS FOTOS (VISITANTE/DETALLE)
 */
export const subscribeToVisitorEvent = (identifier: string | null, callback: (events: EventConfig[]) => void) => {
  let docQuery: any;
  
  if (!identifier) {
    docQuery = query(collection(db, EVENTS_COLLECTION), orderBy('date', 'desc'), limit(1));
  } else if (identifier.startsWith('event-') && !identifier.startsWith('evento-')) {
    docQuery = doc(db, EVENTS_COLLECTION, identifier);
  } else {
    docQuery = query(collection(db, EVENTS_COLLECTION), where('publicToken', '==', identifier), limit(1));
  }

  let photoUnsubscribe: (() => void) | null = null;
  let currentEventId: string | null = null; 

  const handleEventDoc = (eventData: EventConfig, eventId: string) => {
      if (eventId === currentEventId && photoUnsubscribe) {
          // Optimization: keep listener if same event
      }
      currentEventId = eventId;

      const legacyPhotos = eventData.photos || [];
      const photosColRef = collection(db, EVENTS_COLLECTION, eventId, 'photos');
      
      const qPhotos = query(photosColRef); 

      if (photoUnsubscribe) photoUnsubscribe();

      photoUnsubscribe = onSnapshot(qPhotos, (photoSnaps) => {
          const subcollectionPhotos = photoSnaps.docs.map(p => p.data() as Photo);
          
          const photoMap = new Map<string, Photo>();
          legacyPhotos.forEach(p => photoMap.set(p.id, p));
          subcollectionPhotos.forEach(p => photoMap.set(p.id, p));

          const allPhotos = Array.from(photoMap.values()).sort((a, b) => {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          callback([{ ...eventData, id: eventId, photos: allPhotos }]);
      }, (error) => {
          console.error("🔥 Error leyendo fotos de subcolección:", error);
      });
  };

  const mainUnsubscribe = onSnapshot(docQuery, (snapshot: any) => {
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

  return () => {
      mainUnsubscribe();
      if (photoUnsubscribe) photoUnsubscribe();
  };
};

export const saveEventToFirebase = async (event: EventConfig) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, event.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { photos, ...eventDataWithoutPhotos } = event;
    await setDoc(eventRef, eventDataWithoutPhotos, { merge: true }); 
  } catch (error) {
    console.error("Error guardando evento:", error);
    throw error;
  }
};

export const updateEventFieldInFirebase = async (eventId: string, fieldPath: string, value: any) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    await updateDoc(eventRef, { [fieldPath]: value });
  } catch (error) {
    console.error(`Error actualizando ${fieldPath}:`, error);
    throw error;
  }
};

// HELPER: Borrado recursivo de carpeta en Storage
const deleteFolderRecursive = async (path: string) => {
    const listRef = ref(storage, path);
    try {
        const res = await listAll(listRef);
        // Borrar archivos
        const filePromises = res.items.map((itemRef) => deleteObject(itemRef));
        await Promise.all(filePromises);
        
        // Borrar subcarpetas
        const folderPromises = res.prefixes.map((folderRef) => deleteFolderRecursive(folderRef.fullPath));
        await Promise.all(folderPromises);
    } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
            console.warn(`Error limpiando carpeta ${path}:`, error);
        }
    }
};

export const deleteEventFromFirebase = async (eventId: string) => {
  try {
    // 1. Limpiar Storage (Fotos, Videos, Thumbnails del evento)
    await deleteFolderRecursive(`eventos/${eventId}`);

    // 2. Limpiar Subcolección de fotos (si existe)
    // Nota: Firestore no borra subcolecciones automáticamente al borrar el padre.
    const photosRef = collection(db, EVENTS_COLLECTION, eventId, 'photos');
    const photoSnaps = await getDocs(photosRef);
    
    // Usamos batch (límite 500 ops, si hay más podría fallar, pero para uso normal está bien)
    const batch = writeBatch(db);
    photoSnaps.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    if (!photoSnaps.empty) {
        await batch.commit();
    }

    // 3. Borrar Documento Principal
    await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
  } catch (error) {
    console.error("Error eliminando evento:", error);
    throw error;
  }
};

export const deleteFileFromFirebase = async (fileUrl: string) => {
  try {
    if (!fileUrl) return;
    let fileRef;
    if (fileUrl.startsWith('gs://')) {
      fileRef = ref(storage, fileUrl);
    } else {
      const decodedUrl = decodeURIComponent(fileUrl);
      const match = decodedUrl.match(/\/o\/(.+)\?/);
      if (!match || !match[1]) return;
      fileRef = ref(storage, match[1]);
    }
    await deleteObject(fileRef);
  } catch (error: any) {
    if (error.code !== 'storage/object-not-found') {
      console.error("Error borrando archivo:", error);
    }
  }
};

export const uploadFileToFirebase = async (
    file: File, 
    path: string, 
    onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, path);
      
      // Robust contentType detection
      let contentType = file.type;
      if (!contentType || contentType === '') {
         const ext = file.name.split('.').pop()?.toLowerCase();
         if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
         else if (ext === 'png') contentType = 'image/png';
         else if (ext === 'webp') contentType = 'image/webp';
         else if (ext === 'gif') contentType = 'image/gif';
         else if (ext === 'mp4') contentType = 'video/mp4';
         else if (ext === 'mov') contentType = 'video/quicktime';
         else contentType = 'application/octet-stream';
      }

      const metadata = { contentType };
      
      // Use uploadBytesResumable instead of uploadBytes to track progress
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        }, 
        (error) => {
          console.error("Error subiendo archivo:", error.code, error.message);
          reject(error);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    } catch (error: any) {
      console.error("Error iniciando subida:", error);
      reject(error);
    }
  });
};

const resizeImage = (file: File, maxWidth: number, quality: number): Promise<File> => {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) { resolve(file); return; }
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
            if (!ctx) { 
                URL.revokeObjectURL(url);
                resolve(file); 
                return; 
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                    const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    resolve(new File([blob], newName, { type: 'image/webp', lastModified: Date.now() }));
                } else resolve(file);
            }, 'image/webp', quality);
        };
        
        img.onerror = () => { 
            URL.revokeObjectURL(url); 
            resolve(file); 
        };
        
        img.src = url;
    });
};

export const processAndUploadPhoto = async (
  file: File, 
  eventId: string, 
  authorName: string, 
  authorColor: string,
  deviceId: string,
  onProgress?: (progress: number) => void
): Promise<Photo> => {
  if (!eventId) throw new Error("ID requerido.");
  
  const isVideo = file.type.startsWith('video/') || file.type === 'video/quicktime';
  const timestamp = Date.now();
  
  // LOGIC CHANGE: Create a readable folder name for the user
  const safeAuthor = (authorName || 'anonimo').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const shortDevice = deviceId ? deviceId.slice(-6) : 'unk';
  const userIdFolder = `${safeAuthor}_${shortDevice}`; // e.g. Juan_Perez_a1b2c3

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const photoId = `photo-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;

  let mainUrl = '', thumbUrl = '';
  let finalSize = 0;
  
  if (isVideo) {
      const path = `eventos/${eventId}/${userIdFolder}/${timestamp}_${sanitizedName}`;
      // Pass progress callback directly for videos
      mainUrl = await uploadFileToFirebase(file, path, onProgress);
      thumbUrl = mainUrl; 
      finalSize = file.size;
  } else {
      try {
          const webpName = sanitizedName.replace(/\.[^/.]+$/, "") + ".webp";
          
          let mainImg = file;
          try {
             mainImg = await resizeImage(file, 2500, 0.90); 
          } catch(err) { console.warn("Resize failed, using original", err); }

          // Pass progress callback for main image
          mainUrl = await uploadFileToFirebase(mainImg, `eventos/${eventId}/${userIdFolder}/${timestamp}_${webpName}`, onProgress);
          finalSize = mainImg.size;

          let thumbImg = file;
          try {
             thumbImg = await resizeImage(file, 1200, 0.80);
          } catch(err) { console.warn("Thumb resize failed", err); }
           
          thumbUrl = await uploadFileToFirebase(thumbImg, `eventos/${eventId}/${userIdFolder}/thumbnails/thumb_${timestamp}_${webpName}`);
      } catch (e) {
          console.warn("Fallback to Original Upload due to error", e);
          mainUrl = await uploadFileToFirebase(file, `eventos/${eventId}/${userIdFolder}/${timestamp}_${sanitizedName}`, onProgress);
          thumbUrl = await uploadFileToFirebase(file, `eventos/${eventId}/${userIdFolder}/thumbnails/thumb_${timestamp}_${sanitizedName}`);
          finalSize = file.size;
      }
  }

  const newPhoto: Photo = {
    id: photoId,
    url: mainUrl,
    thumbnail: thumbUrl,
    width: 0, height: 0,
    title: file.name,
    category: 'General',
    likes: 0,
    reports: 0,
    likedByMe: false,
    isArchived: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    author: { name: authorName, initials: authorName.substring(0, 2).toUpperCase(), avatarColor: authorColor },
    type: isVideo ? 'video' : 'photo',
    deviceId: deviceId,
    size: finalSize
  };

  try {
      await setDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId), newPhoto);
  } catch (error) {
      console.error("🔥 Error guardando en Firestore:", error);
      throw error;
  }

  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  try {
      await updateDoc(eventRef, { totalUsageBytes: increment(finalSize) });
  } catch(e) {
      console.warn("No se pudo actualizar totalUsageBytes, pero la foto se guardó.", e);
  }

  return newPhoto;
};

export const togglePhotoLike = async (eventId: string, photoId: string, incrementVal: boolean) => {
    const loc = await getPhotoLocation(eventId, photoId);
    if (loc === 'subcollection') {
        await updateDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId), { likes: increment(incrementVal ? 1 : -1) });
    } else {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await runTransaction(db, async (t) => {
            const d = await t.get(eventRef);
            if (!d.exists()) return;
            const photos = d.data().photos || [];
            const idx = photos.findIndex((p:any) => p.id === photoId);
            if (idx >= 0) {
                photos[idx].likes = Math.max(0, photos[idx].likes + (incrementVal ? 1 : -1));
                t.update(eventRef, { photos });
            }
        });
    }
};

export const reportPhoto = async (eventId: string, photoId: string) => {
    const loc = await getPhotoLocation(eventId, photoId);
    if (loc === 'subcollection') {
        await updateDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId), { reports: increment(1) });
    } else {
         const eventRef = doc(db, EVENTS_COLLECTION, eventId);
         await runTransaction(db, async (t) => {
             const d = await t.get(eventRef);
             if (!d.exists()) return;
             const photos = d.data().photos || [];
             const idx = photos.findIndex((p:any) => p.id === photoId);
             if (idx >= 0) {
                 photos[idx].reports = (photos[idx].reports || 0) + 1;
                 t.update(eventRef, { photos });
             }
         });
    }
};

export const resolvePhotoReport = async (eventId: string, photoId: string) => {
    const loc = await getPhotoLocation(eventId, photoId);
    if (loc === 'subcollection') {
        await updateDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId), { reports: 0 });
    } else {
         // Legacy logic omitted
    }
};

export const updatePhotoField = async (eventId: string, photoId: string, field: string, value: any) => {
    const loc = await getPhotoLocation(eventId, photoId);
    if (loc === 'subcollection') {
        await updateDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId), { [field]: value });
    } else {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await runTransaction(db, async (t) => {
            const d = await t.get(eventRef);
            if (!d.exists()) return;
            const photos = d.data().photos || [];
            const idx = photos.findIndex((p:any) => p.id === photoId);
            if (idx >= 0) {
                photos[idx] = { ...photos[idx], [field]: value };
                t.update(eventRef, { photos });
            }
        });
    }
};

export const batchUpdatePhotos = async (eventId: string, photoIds: string[], updates: Partial<Photo>) => {
    const batch = writeBatch(db);
    const legacyIds: string[] = [];

    await Promise.all(photoIds.map(async (id) => {
        const ref = doc(db, EVENTS_COLLECTION, eventId, 'photos', id);
        const snap = await getDoc(ref);
        if (snap.exists()) batch.update(ref, updates);
        else legacyIds.push(id);
    }));

    await batch.commit();

    if (legacyIds.length > 0) {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await runTransaction(db, async (t) => {
            const d = await t.get(eventRef);
            if (!d.exists()) return;
            const photos = d.data().photos || [];
            let changed = false;
            legacyIds.forEach(id => {
                const idx = photos.findIndex((p:any) => p.id === id);
                if (idx >= 0) { photos[idx] = { ...photos[idx], ...updates }; changed = true; }
            });
            if (changed) t.update(eventRef, { photos });
        });
    }
};

export const softDeletePhoto = (eventId: string, photoId: string) => updatePhotoField(eventId, photoId, 'isDeleted', true);
export const restorePhoto = (eventId: string, photoId: string) => updatePhotoField(eventId, photoId, 'isDeleted', false);
export const archivePhoto = (eventId: string, photoId: string, archive: boolean) => updatePhotoField(eventId, photoId, 'isArchived', archive);

export const permanentDeletePhoto = async (eventId: string, photoId: string, photoUrl: string, thumbnailUrl?: string) => {
    await deleteFileFromFirebase(photoUrl);
    if (thumbnailUrl && thumbnailUrl !== photoUrl) await deleteFileFromFirebase(thumbnailUrl);
    
    const loc = await getPhotoLocation(eventId, photoId);
    if (loc === 'subcollection') {
        await deleteDoc(doc(db, EVENTS_COLLECTION, eventId, 'photos', photoId));
    } else {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await runTransaction(db, async (t) => {
            const d = await t.get(eventRef);
            if (!d.exists()) return;
            const photos = d.data().photos || [];
            t.update(eventRef, { photos: photos.filter((p:any) => p.id !== photoId) });
        });
    }
};

export const recalculateEventStorageUsage = async (eventId: string, photos: Photo[]) => {
    // Calculamos el tamaño real sumando los bytes de todas las fotos
    const totalBytes = photos.reduce((acc, curr) => acc + (curr.size || 0), 0);
    
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await updateDoc(eventRef, { totalUsageBytes: totalBytes });
    } catch (error) {
        console.error("Error recalculando uso:", error);
    }
    
    return totalBytes;
};

export const reprocessEventPhotos = async (
  eventId: string,
  onProgress?: (current: number, total: number) => void
) => {
  if (!eventId) throw new Error("eventId requerido");

  const photosSnap = await getDocs(
    collection(db, EVENTS_COLLECTION, eventId, 'photos')
  );


  const photos = photosSnap.docs.map(d => d.data() as Photo);

  // 🔎 Detectar SOLO fotos viejas
  const oldPhotos = photos.filter(p => {
    if (p.type === 'video') return false;
    if (p.migratedFromLegacy) return false;
    if (!p.url || !p.thumbnail) return true;
    if (p.thumbnail === p.url) return true;
    if (!p.thumbnail.includes('/thumbnails/')) return true;
    if (!p.url.endsWith('.webp')) return true;
    return false;
  });

  const total = oldPhotos.length;
  let current = 0;
  let processed = 0;

  for (const photo of oldPhotos) {
    current++;
    onProgress?.(current, total);

    try {
      // 1️⃣ Descargar archivo viejo
      const response = await fetch(photo.url);
      const blob = await response.blob();

      const file = new File(
        [blob],
        photo.title || 'photo',
        { type: blob.type || 'image/jpeg' }
      );

      // 2️⃣ Re-subir usando la lógica NUEVA
      const newPhoto = await processAndUploadPhoto(
        file,
        eventId,
        photo.author?.name || 'Anónimo',
        photo.author?.avatarColor || '#999999',
        photo.deviceId || 'legacy'
      );

      // 3️⃣ Restaurar datos importantes
      await updateDoc(
        doc(db, EVENTS_COLLECTION, eventId, 'photos', newPhoto.id),
        {
          likes: photo.likes || 0,
          category: photo.category || 'General',
          createdAt: photo.createdAt,
          migratedFromLegacy: true
        }
      );

      // 4️⃣ Borrar archivos viejos
      await deleteFileFromFirebase(photo.url);
      if (photo.thumbnail && photo.thumbnail !== photo.url) {
        await deleteFileFromFirebase(photo.thumbnail);
      }

      // 5️⃣ Borrar documento viejo
      await deleteDoc(
        doc(db, EVENTS_COLLECTION, eventId, 'photos', photo.id)
      );

      processed++; // ✅ AQUÍ


    } catch (err) {
      console.error("Error reprocesando foto", photo.id, err);
      // ⚠️ No detenemos todo si una falla
    }
  }

  return {
    total,
    processed
  };
};

/**
 * 1. ESCANEAR ARCHIVOS HUÉRFANOS (SIN BORRAR)
 * Devuelve la lista de rutas que NO existen en Firestore pero SÍ en Storage.
 */
export const scanEventOrphanFiles = async (eventId: string): Promise<string[]> => {
    if (!eventId) throw new Error("eventId requerido");

    // 1️⃣ Obtener rutas válidas desde Firestore
    const photosSnap = await getDocs(collection(db, EVENTS_COLLECTION, eventId, 'photos'));
    const validPaths = new Set<string>();

    photosSnap.docs.forEach(doc => {
        const photo = doc.data() as Photo;
        [photo.url, photo.thumbnail].forEach(url => {
            if (!url) return;
            if (url.startsWith('gs://')) {
                validPaths.add(url.replace(/^gs:\/\/[^/]+\//, ''));
            } else {
                const match = decodeURIComponent(url).match(/\/o\/(.+)\?/);
                if (match?.[1]) validPaths.add(match[1]);
            }
        });
        
        // También protegemos los assets del evento (avatar, banner)
        // Nota: Idealmente deberíamos pasarlos como argumento o leer el doc del evento,
        // pero por seguridad asumimos que si están en la carpeta 'assets', podríamos querer conservarlos
        // o validarlos. Para esta implementación estricta, si no está en `photos`, es huérfano.
        // MEJORA: Leer el doc del evento para proteger banner/avatar.
    });

    // Leer doc del evento para proteger banner y avatar
    const eventDoc = await getDoc(doc(db, EVENTS_COLLECTION, eventId));
    if (eventDoc.exists()) {
        const evt = eventDoc.data() as EventConfig;
        [evt.coverImage, evt.theme?.avatarImage].forEach(url => {
            if (!url) return;
            const match = decodeURIComponent(url).match(/\/o\/(.+)\?/);
            if (match?.[1]) validPaths.add(match[1]);
        });
    }

    // 2️⃣ Listar TODOS los archivos del evento en Storage
    const baseRef = ref(storage, `eventos/${eventId}`);
    const allFiles: string[] = [];

    const walk = async (folderRef: any) => {
        const res = await listAll(folderRef);
        res.items.forEach(item => allFiles.push(item.fullPath));
        await Promise.all(res.prefixes.map(walk));
    };

    await walk(baseRef);

    // 3️⃣ Filtrar huérfanos
    return allFiles.filter(path => !validPaths.has(path));
};

/**
 * 2. BORRAR ARCHIVOS ESPECÍFICOS (SEGUNDO PASO)
 */
export const deleteStorageFilesBatch = async (
    filePaths: string[],
    onProgress?: (deleted: number, total: number) => void
) => {
    let deleted = 0;
    const total = filePaths.length;

    for (const path of filePaths) {
        try {
            await deleteObject(ref(storage, path));
            deleted++;
            onProgress?.(deleted, total);
        } catch (e) {
            console.warn("No se pudo borrar:", path, e);
        }
    }
    return { deleted, total };
};

// MANTENEMOS LA FUNCIÓN ANTIGUA POR COMPATIBILIDAD (O LA REDIRIGIMOS)
export const cleanupOrphanStorageFiles = async (
  eventId: string,
  onProgress?: (deleted: number, total: number) => void
) => {
    // Versión legacy que hace todo de una vez
    const orphans = await scanEventOrphanFiles(eventId);
    return await deleteStorageFilesBatch(orphans, onProgress);
};
