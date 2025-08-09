import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1w0tPJff953vbLjNDVCUBdFKZdw9m9lE",
  authDomain: "odyssey-test-db.firebaseapp.com",
  databaseURL: "https://odyssey-test-db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "odyssey-test-db",
  storageBucket: "odyssey-test-db.firebasestorage.app",
  messagingSenderId: "795570037018",
  appId: "1:795570037018:web:da29a70ab225676ae68ca3",
  measurementId: "G-WX6N95FZYM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);

// Initialize Analytics (only for web)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };

export default app; 