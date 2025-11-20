
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuración de tu proyecto "Album"
const firebaseConfig = {
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
export const db = getFirestore(app);
export const storage = getStorage(app);
