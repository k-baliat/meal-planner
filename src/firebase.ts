// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
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
  notes: 'notes',
  sharedRecipes: 'sharedRecipes', // For tracking recipe sharing between users
  users: 'users' // User profiles collection
};

// Authentication state management
// We use a callback-based approach to notify components when auth state changes
let currentUser: User | null = null;
let authStateListeners: Array<(user: User | null) => void> = [];

// Set up authentication state observer
// This runs whenever the authentication state changes (login, logout, token refresh)
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  // Notify all registered listeners about the auth state change
  authStateListeners.forEach(listener => listener(user));
});

/**
 * Get the current authenticated user
 * 
 * This function returns the currently authenticated user.
 * Returns null if no user is authenticated.
 * 
 * @returns The current authenticated user or null if not authenticated
 */
export const getCurrentUser = (): User | null => {
  return currentUser;
};

/**
 * Subscribe to Authentication State Changes
 * 
 * This function allows components to listen for authentication state changes.
 * It returns a cleanup function that should be called when the component unmounts.
 * 
 * @param callback - Function to call when auth state changes
 * @returns Cleanup function to unsubscribe
 */
export const onAuthStateChange = (callback: (user: User | null) => void): (() => void) => {
  // Add the callback to our listeners array
  authStateListeners.push(callback);
  
  // Immediately call the callback with the current user state
  callback(currentUser);
  
  // Return a cleanup function that removes this listener
  return () => {
    authStateListeners = authStateListeners.filter(listener => listener !== callback);
  };
};

/**
 * Sign Out
 * 
 * This function signs out the current user.
 * 
 * @returns A promise that resolves when sign out is complete
 */
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Require Authentication
 * 
 * This function ensures the user is authenticated before making Firestore calls.
 * It throws an error if the user is not authenticated.
 * 
 * @returns The authenticated user
 * @throws Error if user is not authenticated
 */
export const requireAuth = (): User => {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User must be authenticated to perform this action');
  }
  return user;
}; 
