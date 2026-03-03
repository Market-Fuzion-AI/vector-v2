import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCKviHT1-UtvfmTWzlJWMbk38DLRddWWQ0",
  authDomain: "vector-app-dee90.firebaseapp.com",
  projectId: "vector-app-dee90",
  storageBucket: "vector-app-dee90.firebasestorage.app",
  messagingSenderId: "177354338130",
  appId: "1:177354338130:web:d97191d7e2c69f2e91948b",
  measurementId: "G-GL790EK7QS"
};

// Initialize Firebase (Singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Set persistence to local (default, but explicit is safer)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Firebase persistence error:", error);
});

// Debug logging
console.log("[Firebase Init]", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKeyValid: firebaseConfig.apiKey.startsWith("AIza"),
});

export { app, auth, db, storage };
