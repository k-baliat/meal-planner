/**
 * Authentication Test Helpers
 * 
 * Utility functions for testing authentication in the browser console
 * or in manual test scenarios.
 * 
 * Usage in browser console:
 * import { testSignUp, testSignIn, testSignOut } from './utils/authTestHelpers';
 * 
 * Or copy-paste the functions directly into the browser console.
 */

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from '../firebase';

// Test credentials
export const TEST_EMAIL = 'cursor_test@testing.com';
export const TEST_PASSWORD = '123456';

/**
 * Test Sign Up
 * 
 * Creates a new user account with test credentials.
 * 
 * @returns Promise that resolves with user object or error
 */
export const testSignUp = async () => {
  try {
    console.log('🧪 Testing Sign Up...');
    console.log(`Email: ${TEST_EMAIL}`);
    console.log(`Password: ${TEST_PASSWORD}`);
    
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      TEST_EMAIL,
      TEST_PASSWORD
    );
    
    console.log('✅ Sign Up Successful!');
    console.log('User ID:', userCredential.user.uid);
    console.log('User Email:', userCredential.user.email);
    console.log('Email Verified:', userCredential.user.emailVerified);
    
    return userCredential.user;
  } catch (error: any) {
    console.error('❌ Sign Up Failed:', error);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    
    // Provide helpful error messages
    if (error.code === 'auth/email-already-in-use') {
      console.log('💡 This email is already registered. Try testSignIn() instead.');
    } else if (error.code === 'auth/weak-password') {
      console.log('💡 Password is too weak. Use a stronger password.');
    } else if (error.code === 'auth/invalid-email') {
      console.log('💡 Email format is invalid.');
    }
    
    throw error;
  }
};

/**
 * Test Sign In
 * 
 * Signs in with test credentials.
 * 
 * @returns Promise that resolves with user object or error
 */
export const testSignIn = async () => {
  try {
    console.log('🧪 Testing Sign In...');
    console.log(`Email: ${TEST_EMAIL}`);
    console.log(`Password: ${TEST_PASSWORD}`);
    
    const userCredential = await signInWithEmailAndPassword(
      auth,
      TEST_EMAIL,
      TEST_PASSWORD
    );
    
    console.log('✅ Sign In Successful!');
    console.log('User ID:', userCredential.user.uid);
    console.log('User Email:', userCredential.user.email);
    console.log('Email Verified:', userCredential.user.emailVerified);
    
    return userCredential.user;
  } catch (error: any) {
    console.error('❌ Sign In Failed:', error);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    
    // Provide helpful error messages
    if (error.code === 'auth/user-not-found') {
      console.log('💡 No account found with this email. Try testSignUp() first.');
    } else if (error.code === 'auth/wrong-password') {
      console.log('💡 Incorrect password. Check your password.');
    } else if (error.code === 'auth/invalid-email') {
      console.log('💡 Email format is invalid.');
    } else if (error.code === 'auth/too-many-requests') {
      console.log('💡 Too many failed attempts. Please try again later.');
    }
    
    throw error;
  }
};

/**
 * Test Sign Out
 * 
 * Signs out the current user.
 * 
 * @returns Promise that resolves when sign out is complete
 */
export const testSignOut = async () => {
  try {
    console.log('🧪 Testing Sign Out...');
    
    await firebaseSignOut(auth);
    
    console.log('✅ Sign Out Successful!');
    
    return true;
  } catch (error: any) {
    console.error('❌ Sign Out Failed:', error);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    
    throw error;
  }
};

/**
 * Test Get Current User
 * 
 * Gets the currently authenticated user.
 * 
 * @returns Current user object or null
 */
export const testGetCurrentUser = () => {
  const user = auth.currentUser;
  
  if (user) {
    console.log('✅ User is authenticated:');
    console.log('User ID:', user.uid);
    console.log('User Email:', user.email);
    console.log('Email Verified:', user.emailVerified);
    return user;
  } else {
    console.log('ℹ️ No user is currently authenticated.');
    return null;
  }
};

/**
 * Test Authentication State
 * 
 * Monitors authentication state changes.
 * 
 * @param duration - How long to monitor (in milliseconds, default: 10000)
 */
export const testAuthState = (duration: number = 10000) => {
  console.log('🧪 Monitoring Authentication State...');
  console.log('This will monitor for', duration / 1000, 'seconds');
  
  const unsubscribe = auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ User authenticated:', user.email);
    } else {
      console.log('ℹ️ User signed out');
    }
  });
  
  // Stop monitoring after duration
  setTimeout(() => {
    unsubscribe();
    console.log('✅ Stopped monitoring authentication state');
  }, duration);
  
  return unsubscribe;
};

/**
 * Run All Authentication Tests
 * 
 * Runs a complete test suite of authentication operations.
 * 
 * @returns Promise that resolves when all tests complete
 */
export const runAllAuthTests = async () => {
  console.log('🚀 Starting Authentication Test Suite...');
  console.log('==========================================');
  
  try {
    // Test 1: Check current state
    console.log('\n📋 Test 1: Check Current Authentication State');
    const currentUser = testGetCurrentUser();
    
    // Test 2: Sign out if signed in
    if (currentUser) {
      console.log('\n📋 Test 2: Sign Out');
      await testSignOut();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
    
    // Test 3: Try to sign in (might fail if account doesn't exist)
    console.log('\n📋 Test 3: Sign In');
    try {
      await testSignIn();
    } catch (error) {
      console.log('ℹ️ Sign in failed (expected if account doesn\'t exist)');
    }
    
    // Test 4: Sign up (will fail if account already exists)
    console.log('\n📋 Test 4: Sign Up');
    try {
      await testSignUp();
      console.log('✅ Account created successfully');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('ℹ️ Account already exists, trying to sign in...');
        await testSignIn();
      } else {
        throw error;
      }
    }
    
    // Test 5: Verify authentication
    console.log('\n📋 Test 5: Verify Authentication');
    const authenticatedUser = testGetCurrentUser();
    if (!authenticatedUser) {
      throw new Error('User should be authenticated at this point');
    }
    
    // Test 6: Sign out
    console.log('\n📋 Test 6: Sign Out');
    await testSignOut();
    
    // Test 7: Verify sign out
    console.log('\n📋 Test 7: Verify Sign Out');
    const signedOutUser = testGetCurrentUser();
    if (signedOutUser) {
      throw new Error('User should be signed out at this point');
    }
    
    console.log('\n==========================================');
    console.log('✅ All Authentication Tests Passed!');
    
  } catch (error) {
    console.error('\n==========================================');
    console.error('❌ Authentication Tests Failed!');
    console.error(error);
    throw error;
  }
};

