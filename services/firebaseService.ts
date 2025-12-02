
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
  orderBy 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { EventConfig, Photo } from '../types';

const EVENTS_COLLECTION = 'events';

/**
 * ESCUCHAR EVENTOS EN TIEMPO REAL
 * Suscribe la app a cambios en la base de datos.
 */
export const subscribeToEvents = (callback: (events: EventConfig[]) => void) => {
  const q = query(collection(db, EVENTS_COLLECTION), orderBy('date', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(doc => doc.data() as EventConfig);
    callback(events);
  });
};

/**
 * GUARDAR O ACTUALIZAR UN EVENTO
 * Guarda toda la configuración del evento (incluyendo array de fotos) en Firestore.
 */
export const saveEventToFirebase = async (event: EventConfig) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, event.id);
    // Convertimos a objeto plano por si acaso hay referencias raras, aunque Firestore maneja JSON bien
    await setDoc(eventRef, event, { merge: true }); 
  } catch (error) {
    console.error("Error guardando evento en Firebase:", error);
    throw error;
  }
};

/**
 * ACTUALIZAR UN CAMPO ESPECÍFICO DE UN EVENTO
 * Usa updateDoc para una actualización atómica y eficiente.
 */
export const updateEventFieldInFirebase = async (eventId: string, fieldPath: string, value: any) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    await updateDoc(eventRef, {
      [fieldPath]: value
    });
  } catch (error) {
    console.error(`Error actualizando el campo ${fieldPath} en Firebase:`, error);
    throw error;
  }
};


/**
 * ELIMINAR EVENTO
 */
export const deleteEventFromFirebase = async (eventId: string) => {
  try {
    await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
  } catch (error) {
    console.error("Error eliminando evento:", error);
    throw error;
  }
};

/**
 * ELIMINAR ARCHIVO DE STORAGE
 * Elimina el archivo físico usando su URL de descarga.
 */
export const deleteFileFromFirebase = async (fileUrl: string) => {
  try {
    if (!fileUrl) return;

    // 1. VALIDACIÓN DE URL
    if (!fileUrl.includes('firebasestorage.googleapis.com')) {
      return; 
    }

    // 2. Intentamos crear la referencia y borrar
    try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
    } catch (innerError: any) {
        if (innerError.code === 'storage/object-not-found') {
            return;
        }
        if (innerError.code === 'storage/invalid-argument') {
            console.warn(`URL inválida para Storage, omitiendo borrado físico: ${fileUrl}`);
            return;
        }
        if (innerError.code === 'storage/unauthorized') {
            throw innerError;
        }
        console.error(`Error no crítico borrando archivo ${fileUrl}:`, innerError);
    }

  } catch (error: any) {
    if (error.code === 'storage/unauthorized') {
      throw error; 
    }
    console.error(`Error general en deleteFileFromFirebase:`, error);
  }
};

/**
 * SUBIR ARCHIVO A STORAGE
 * Sube la foto/video y devuelve la URL pública de descarga.
 */
export const uploadFileToFirebase = async (file: File, path: string): Promise<string> => {
  try {
    console.log(`[FirebaseService] Subiendo: ${path} (${(file.size/1024).toFixed(2)} KB)`);
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error crítico subiendo archivo a Storage:", error);
    throw error;
  }
};

/**
 * REDIMENSIONAR IMAGEN (Helper Flex)
 * Permite crear versiones de diferentes tamaños y calidades.
 * maxWidth: Ancho máximo en px.
 * quality: Calidad JPEG (0.0 - 1.0).
 */
const resizeImage = (file: File, maxWidth: number, quality: number): Promise<File> => {
    return new Promise((resolve, reject) => {
        // Si no es imagen (ej: video), devolver original
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }

        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Calcular nuevas dimensiones manteniendo aspecto
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxWidth) {
                    width *= maxWidth / height;
                    height = maxWidth;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(file); // Fallback a original si falla canvas
                return;
            }

            // Dibujar imagen redimensionada
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                    // Crear nuevo archivo comprimido manteniendo extensión jpg
                    const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                    const compressedFile = new File([blob], newName, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(compressedFile);
                } else {
                    resolve(file); // Fallback
                }
            }, 'image/jpeg', quality);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // Fallback
        };

        img.src = url;
    });
};

/**
 * PROCESAR Y SUBIR FOTOS (OPTIMIZADO)
 * Sube DOS versiones de cada foto:
 * 1. Principal (HD) -> Para Lightbox y Descarga.
 * 2. Thumbnail (SD) -> Para la Galería (ahorra mucho ancho de banda).
 */
export const processAndUploadPhoto = async (
  file: File, 
  eventId: string, 
  authorName: string, 
  authorColor: string,
  deviceId: string
): Promise<Photo> => {
  // 1. VALIDACIÓN
  if (!eventId) throw new Error("ID de evento requerido para subir archivos.");

  const isVideo = file.type.startsWith('video/') || file.type === 'video/quicktime';
  const timestamp = Date.now();
  
  // Usar deviceId o fallback a 'anonimo'
  const userIdFolder = (deviceId && typeof deviceId === 'string' && deviceId.trim() !== '') 
    ? deviceId 
    : 'anonimo';

  // Nombres base
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
  
  let mainDownloadUrl = '';
  let thumbDownloadUrl = '';

  if (isVideo) {
      // Para videos, subimos el original (validado por tamaño en UI)
      // En el futuro se podría generar un poster frame aquí.
      const path = `eventos/${eventId}/${userIdFolder}/${uniqueFileName}`;
      mainDownloadUrl = await uploadFileToFirebase(file, path);
      // Usamos el mismo video como thumbnail (el navegador intentará cargar el primer frame)
      thumbDownloadUrl = mainDownloadUrl; 
  } else {
      // --- OPTIMIZACIÓN DE IMÁGENES (COST SAVING) ---
      
      try {
          // A. Generar IMAGEN PRINCIPAL (Full HD - 1920px, 0.8 calidad)
          // Reduce 5MB -> ~300KB. Suficiente para pantalla completa.
          const mainImage = await resizeImage(file, 1920, 0.8);
          const mainPath = `eventos/${eventId}/${userIdFolder}/${uniqueFileName}`;
          mainDownloadUrl = await uploadFileToFirebase(mainImage, mainPath);

          // B. Generar THUMBNAIL (Miniatura - 500px, 0.6 calidad)
          // Crea versión de ~20-30KB para la cuadrícula. Ahorro masivo de ancho de banda.
          const thumbImage = await resizeImage(file, 500, 0.6);
          const thumbPath = `eventos/${eventId}/${userIdFolder}/thumbnails/thumb_${uniqueFileName}`;
          thumbDownloadUrl = await uploadFileToFirebase(thumbImage, thumbPath);

      } catch (e) {
          console.warn("Falló optimización de imagen, subiendo original", e);
          // Fallback seguro: subir original si falla el procesamiento
          const path = `eventos/${eventId}/${userIdFolder}/${uniqueFileName}`;
          mainDownloadUrl = await uploadFileToFirebase(file, path);
          thumbDownloadUrl = mainDownloadUrl;
      }
  }

  // 5. CREACIÓN DE OBJETO PHOTO
  const newPhoto: Photo = {
    id: `photo-${timestamp}`,
    url: mainDownloadUrl,      // Imagen de alta calidad
    thumbnail: thumbDownloadUrl, // Miniatura ligera
    width: 800, // Valor estimado
    height: 600,
    title: file.name,
    category: 'General', 
    likes: 0,
    likedByMe: false,
    isArchived: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    author: {
      name: authorName,
      initials: authorName.substring(0, 2).toUpperCase(),
      avatarColor: authorColor
    },
    type: isVideo ? 'video' : 'photo',
    deviceId: deviceId
  };

  return newPhoto;
};

/**
 * OBTENER UN EVENTO ESPECÍFICO
 */
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
