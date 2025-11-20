
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
 * Ideal para cambios puntuales como toggles o remover una imagen.
 */
export const updateEventFieldInFirebase = async (eventId: string, fieldPath: string, value: any) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, eventId);
    // updateDoc soporta notación de puntos para campos anidados (ej: 'theme.coverImage')
    await updateDoc(eventRef, {
      [fieldPath]: value
    });
  } catch (error) {
    console.error(`Error actualizando el campo ${fieldPath} en Firebase:`, error);
    // Re-lanzamos el error para que el componente que llama pueda manejarlo y mostrar un UI de error.
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
 * AHORA ES ROBUSTA: Maneja errores de permisos explícitamente y URLs externas.
 */
export const deleteFileFromFirebase = async (fileUrl: string) => {
  try {
    if (!fileUrl) return;

    // 1. VALIDACIÓN DE URL: Si no es de Firebase Storage (ej: Google Drive, url externa),
    // NO intentamos borrarla físicamente. Solo retornamos éxito para que se borre de la DB.
    if (!fileUrl.includes('firebasestorage.googleapis.com')) {
      // Es normal que esto pase con fotos importadas, no es un error.
      return; 
    }

    // 2. Intentamos crear la referencia y borrar
    try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
    } catch (innerError: any) {
        // Si el error es que el objeto no existe, perfecto, ya está borrado.
        if (innerError.code === 'storage/object-not-found') {
            return;
        }
        // Si es un error de URL inválida (a veces pasa con caracteres raros), lo ignoramos
        // para permitir que la limpieza de la base de datos continúe.
        if (innerError.code === 'storage/invalid-argument') {
            console.warn(`URL inválida para Storage, omitiendo borrado físico: ${fileUrl}`);
            return;
        }
        // Si es error de permisos, lo relanzamos para avisar al usuario
        if (innerError.code === 'storage/unauthorized') {
            throw innerError;
        }
        // Otros errores los logueamos pero no detenemos el proceso masivo
        console.error(`Error no crítico borrando archivo ${fileUrl}:`, innerError);
    }

  } catch (error: any) {
    // Relanzar solo si es error de permisos para mostrar la alerta gigante
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
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error subiendo archivo:", error);
    throw error;
  }
};

/**
 * PROCESAR Y SUBIR FOTOS
 * Reemplaza la lógica local. Sube el archivo real a Storage y devuelve el objeto Photo.
 * MODIFICADO: Ahora guarda en eventos/{ID}/fotos/ para mantener orden estricto.
 */
export const processAndUploadPhoto = async (
  file: File, 
  eventId: string, 
  authorName: string, 
  authorColor: string,
  deviceId: string
): Promise<Photo> => {
  const isVideo = file.type.startsWith('video/') || file.type === 'video/quicktime';
  const timestamp = Date.now();
  
  // Limpiamos el nombre del archivo para evitar caracteres raros en Storage
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
  
  // ESTRUCTURA DE CARPETAS SOLICITADA: eventos/{ID_DEL_EVENTO}/fotos/{nombre_archivo_unico}
  const path = `eventos/${eventId}/fotos/${uniqueFileName}`;

  // 1. Subir el archivo original a Firebase Storage
  const downloadUrl = await uploadFileToFirebase(file, path);

  // 2. Crear el objeto Photo
  const newPhoto: Photo = {
    id: `photo-${timestamp}`,
    url: downloadUrl,
    thumbnail: downloadUrl, // Idealmente sería una versión reducida
    width: 800, // Valor estimado
    height: 600,
    title: file.name,
    category: 'General', // Se puede ajustar después
    likes: 0,
    likedByMe: false,
    isArchived: false,
    createdAt: new Date().toLocaleString(),
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
 * Obtiene los datos de un único evento por su ID.
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
