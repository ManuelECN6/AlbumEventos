
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
    // Firebase permite crear una referencia directamente desde la URL HTTPS completa
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
  } catch (error) {
    console.error("Error eliminando archivo de Storage:", error);
    // No lanzamos error para permitir que el proceso continúe y elimine la referencia en BD
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
  const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const path = `events/${eventId}/${fileName}`;

  // 1. Subir el archivo original a Firebase Storage
  const downloadUrl = await uploadFileToFirebase(file, path);

  // 2. Crear el objeto Photo
  // Nota: En una app real de producción, generaríamos un thumbnail más pequeño.
  // Aquí usamos la misma URL para simplificar.
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
