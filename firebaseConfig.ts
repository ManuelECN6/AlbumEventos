import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuración de tu proyecto "Album"
export const firebaseConfig = {
  apiKey: "AIzaSyAnDd_S1Nw8LUPfEQzZ2sBVmfBsf6VOUoE",
  authDomain: "album-31eb4.firebaseapp.com",
  projectId: "album-31eb4",
  storageBucket: "album-31eb4.firebasestorage.app",
  messagingSenderId: "13911555072",
  appId: "1:13911555072:web:448d15d140bb4c65bf6ce5",
  measurementId: "G-2KK3ELW168"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios de Base de Datos y Almacenamiento para usarlos en la app
// Usamos initializeFirestore con long polling forzado para evitar timeouts de conexión (Error de 10s)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);