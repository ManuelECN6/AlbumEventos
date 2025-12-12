
import * as firebaseApp from "firebase/app";
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

// Inicializar Firebase de forma modular estándar
// Fix: Use named imports via namespace to avoid 'no exported member' error in some TS environments
// Fix: Use getApps() to prevent double initialization during hot-reload

// Workaround for missing exports in some environment type definitions
const { initializeApp, getApps, getApp } = firebaseApp as any;

const app = getApps().length === 0 
  ? initializeApp(firebaseConfig) 
  : getApp();

// Exportar los servicios de Base de Datos y Almacenamiento
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);
