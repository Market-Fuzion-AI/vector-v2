import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCKviHT1-UtvfmTWzlJWMbk38DLRddWWQ0",
  authDomain: "vector-app-dee90.firebaseapp.com",
  projectId: "vector-app-dee90",
  storageBucket: "vector-app-dee90.firebasestorage.app",
  messagingSenderId: "177354338130",
  appId: "1:177354338130:web:d97191d7e2c69f2e91948b",
  measurementId: "G-GL790EK7QS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
