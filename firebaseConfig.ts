import * as firebaseApp from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyAnDd_S1Nw8LUPfEQzZ2sBVmfBsf6VOUoE",
  authDomain: "album-31eb4.firebaseapp.com",
  projectId: "album-31eb4",
  storageBucket: "album-31eb4.firebasestorage.app",
  messagingSenderId: "13911555072",
  appId: "1:13911555072:web:448d15d140bb4c65bf6ce5",
  measurementId: "G-2KK3ELW168"
};

// Initialize Firebase
// Cast to any to bypass potential type definition mismatches in the environment
const app = (firebaseApp as any).initializeApp(firebaseConfig);

// Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);