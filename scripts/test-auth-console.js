/**
 * Browser Console Authentication Test Script
 * 
 * Copy and paste this entire script into your browser console
 * to test authentication functionality.
 * 
 * Make sure you're on the app page and Firebase is initialized.
 * 
 * Test Credentials:
 * - Email: cursor_test@testing.com
 * - Password: 123456
 */

(function() {
  console.log('🚀 Authentication Test Script Loaded');
  console.log('=====================================');
  console.log('Test Credentials:');
  console.log('Email: cursor_test@testing.com');
  console.log('Password: 123456');
  console.log('=====================================\n');

  // Test credentials
  const TEST_EMAIL = 'cursor_test@testing.com';
  const TEST_PASSWORD = '123456';

  // Helper function to get Firebase auth instance
  function getAuth() {
    // Try to access auth from window or module
    if (window.firebase && window.firebase.auth) {
      return window.firebase.auth();
    }
    // If using React, you might need to import it differently
    // This is a fallback - adjust based on your setup
    throw new Error('Firebase auth not found. Make sure Firebase is initialized.');
  }

  // Test Sign Up
  window.testSignUp = async function() {
    try {
      console.log('🧪 Testing Sign Up...');
      const auth = getAuth();
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );
      
      console.log('✅ Sign Up Successful!');
      console.log('User ID:', userCredential.user.uid);
      console.log('User Email:', userCredential.user.email);
      
      return userCredential.user;
    } catch (error) {
      console.error('❌ Sign Up Failed:', error);
      if (error.code === 'auth/email-already-in-use') {
        console.log('💡 Email already registered. Try testSignIn() instead.');
      }
      throw error;
    }
  };

  // Test Sign In
  window.testSignIn = async function() {
    try {
      console.log('🧪 Testing Sign In...');
      const auth = getAuth();
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      
      const userCredential = await signInWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );
      
      console.log('✅ Sign In Successful!');
      console.log('User ID:', userCredential.user.uid);
      console.log('User Email:', userCredential.user.email);
      
      return userCredential.user;
    } catch (error) {
      console.error('❌ Sign In Failed:', error);
      if (error.code === 'auth/user-not-found') {
        console.log('💡 No account found. Try testSignUp() first.');
      } else if (error.code === 'auth/wrong-password') {
        console.log('💡 Incorrect password.');
      }
      throw error;
    }
  };

  // Test Sign Out
  window.testSignOut = async function() {
    try {
      console.log('🧪 Testing Sign Out...');
      const auth = getAuth();
      const { signOut } = await import('firebase/auth');
      
      await signOut(auth);
      console.log('✅ Sign Out Successful!');
      
      return true;
    } catch (error) {
      console.error('❌ Sign Out Failed:', error);
      throw error;
    }
  };

  // Get Current User
  window.testGetCurrentUser = function() {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (user) {
      console.log('✅ User is authenticated:');
      console.log('User ID:', user.uid);
      console.log('User Email:', user.email);
      return user;
    } else {
      console.log('ℹ️ No user is currently authenticated.');
      return null;
    }
  };

  // Run All Tests
  window.runAllAuthTests = async function() {
    console.log('🚀 Starting Authentication Test Suite...');
    console.log('==========================================');
    
    try {
      // Test 1: Check current state
      console.log('\n📋 Test 1: Check Current Authentication State');
      const currentUser = window.testGetCurrentUser();
      
      // Test 2: Sign out if signed in
      if (currentUser) {
        console.log('\n📋 Test 2: Sign Out');
        await window.testSignOut();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Test 3: Try to sign in
      console.log('\n📋 Test 3: Sign In');
      try {
        await window.testSignIn();
      } catch (error) {
        console.log('ℹ️ Sign in failed, trying sign up...');
        await window.testSignUp();
      }
      
      // Test 4: Verify authentication
      console.log('\n📋 Test 4: Verify Authentication');
      const authenticatedUser = window.testGetCurrentUser();
      if (!authenticatedUser) {
        throw new Error('User should be authenticated');
      }
      
      // Test 5: Sign out
      console.log('\n📋 Test 5: Sign Out');
      await window.testSignOut();
      
      // Test 6: Verify sign out
      console.log('\n📋 Test 6: Verify Sign Out');
      const signedOutUser = window.testGetCurrentUser();
      if (signedOutUser) {
        throw new Error('User should be signed out');
      }
      
      console.log('\n==========================================');
      console.log('✅ All Authentication Tests Passed!');
      
    } catch (error) {
      console.error('\n==========================================');
      console.error('❌ Authentication Tests Failed!');
      console.error(error);
    }
  };

  console.log('✅ Test functions loaded!');
  console.log('Available functions:');
  console.log('  - testSignUp() - Create a new account');
  console.log('  - testSignIn() - Sign in with test credentials');
  console.log('  - testSignOut() - Sign out current user');
  console.log('  - testGetCurrentUser() - Get current user');
  console.log('  - runAllAuthTests() - Run complete test suite');
  console.log('\nExample: runAllAuthTests()');
})();

