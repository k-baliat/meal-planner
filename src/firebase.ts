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

/**
 * Validate if a user is properly authenticated
 * 
 * This function checks if a user has valid authentication credentials.
 * It ensures the user:
 * - Is not null
 * - Has an email address (not anonymous)
 * - Has a valid provider (not anonymous)
 * 
 * @param user - The user object to validate
 * @returns true if user is properly authenticated, false otherwise
 */
const isValidAuthenticatedUser = (user: User | null): boolean => {
  if (!user) {
    return false;
  }
  
  // Check if user has an email (anonymous users might not have one)
  if (!user.email) {
    console.warn('[Auth] User has no email address - potentially anonymous or invalid session');
    return false;
  }
  
  // Check if user's email is verified or if they have a provider
  // Anonymous users typically don't have providerData
  if (!user.providerData || user.providerData.length === 0) {
    console.warn('[Auth] User has no provider data - potentially anonymous session');
    return false;
  }
  
  // Check that the user is not using anonymous provider
  const hasNonAnonymousProvider = user.providerData.some(
    provider => provider.providerId !== 'anonymous'
  );
  
  if (!hasNonAnonymousProvider) {
    console.warn('[Auth] User only has anonymous provider');
    return false;
  }
  
  return true;
};

/**
 * Clear potentially corrupted authentication data from localStorage
 * 
 * This function removes old Firebase auth tokens that might be from
 * anonymous sessions or corrupted auth states.
 * 
 * This is important because Firebase Auth persists authentication state
 * in the browser's localStorage by default. If anonymous authentication
 * was previously enabled and then disabled, old anonymous sessions
 * might still exist in localStorage and cause issues.
 */
const clearPotentiallyCorruptedAuthData = () => {
  try {
    // Get all localStorage keys that match Firebase auth pattern
    const keysToCheck = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('firebase:authUser:')) {
        keysToCheck.push(key);
      }
    }
    
    // Check if any of these keys contain anonymous auth or invalid data
    keysToCheck.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const authData = JSON.parse(value);
          // If user has no email or only anonymous provider, clear it
          if (!authData.email || 
              !authData.providerData || 
              authData.providerData.length === 0 ||
              authData.providerData.every((p: any) => p.providerId === 'anonymous')) {
            console.warn('[Auth] Clearing potentially corrupted auth data from localStorage');
            localStorage.removeItem(key);
          }
        } catch (e) {
          // If we can't parse it, it might be corrupted - clear it
          console.warn('[Auth] Clearing unparseable auth data from localStorage');
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.error('[Auth] Error clearing localStorage:', error);
  }
};

// Clear any potentially corrupted auth data on app initialization
// This runs once when the firebase module is first imported
clearPotentiallyCorruptedAuthData();

// Authentication state management
// We use a callback-based approach to notify components when auth state changes
let currentUser: User | null = null;
let authStateListeners: Array<(user: User | null) => void> = [];

// Set up authentication state observer
// This runs whenever the authentication state changes (login, logout, token refresh)
onAuthStateChanged(auth, async (user) => {
  // Validate the user before accepting the auth state
  if (user && !isValidAuthenticatedUser(user)) {
    console.warn('[Auth] Invalid or anonymous user detected - signing out');
    try {
      // Sign out invalid users automatically
      await firebaseSignOut(auth);
      currentUser = null;
    } catch (error) {
      console.error('[Auth] Error signing out invalid user:', error);
      currentUser = null;
    }
  } else {
    currentUser = user;
  }
  
  // Notify all registered listeners about the auth state change
  authStateListeners.forEach(listener => listener(currentUser));
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
    console.log('[Auth] User signed out successfully');
  } catch (error) {
    console.error('[Auth] Error signing out:', error);
    throw error;
  }
};

/**
 * Require Authentication
 * 
 * This function ensures the user is authenticated before making Firestore calls.
 * It throws an error if the user is not authenticated or invalid.
 * 
 * @returns The authenticated user
 * @throws Error if user is not authenticated or invalid
 */
export const requireAuth = (): User => {
  const user = getCurrentUser();
  if (!user || !isValidAuthenticatedUser(user)) {
    throw new Error('User must be authenticated to perform this action');
  }
  return user;
}; 
