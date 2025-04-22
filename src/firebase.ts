// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Export collections
export const collections = {
  recipes: 'recipes',
  mealPlans: 'mealPlans',
  shoppingLists: 'shoppingLists',
  notes: 'notes'
};

// Authentication state management
let currentUser: User | null = null;

// Set up authentication state observer
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

/**
 * Get the current authenticated user
 * 
 * @returns The current authenticated user or null if not authenticated
 */
export const getCurrentUser = (): User | null => {
  return currentUser;
};

/**
 * Ensure Authentication
 * 
 * This function ensures the user is authenticated before making Firestore calls.
 * If not authenticated, it will attempt to sign in anonymously.
 * 
 * @returns A promise that resolves when authentication is complete
 */
export const ensureAuthentication = async (): Promise<User> => {
  const user = getCurrentUser();
  if (user) return user;

  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('Error signing in anonymously:', error);
    throw error;
  }
}; 
