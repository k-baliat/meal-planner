// Import React hooks for managing component state
// useState allows us to store and update data that changes over time
import React, { useState } from 'react';

// Import Firebase authentication functions
// These functions allow us to create accounts, sign in, and manage authentication
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  User,
  AuthError
} from 'firebase/auth';

// Import our Firebase auth instance and Firestore
import { auth, db, collections } from '../firebase';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Import secure logging utilities
import { secureLog, secureError } from '../utils/secureLogger';

// Import CSS for styling
import './Auth.css';

/**
 * Auth Component Props
 * 
 * This interface defines the props that the Auth component accepts.
 * - onAuthSuccess: Function to call when authentication is successful
 */
interface AuthProps {
  onAuthSuccess: (user: User) => void;
}

/**
 * Auth Component
 * 
 * This component provides a login and signup interface for users.
 * It allows users to:
 * - Create a new account with email and password
 * - Sign in to an existing account
 * - Switch between login and signup modes
 * 
 * Key Features:
 * - Form validation
 * - Error handling and display
 * - Loading states during authentication
 * - Password visibility toggle
 */
const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  // State to track whether we're in signup or login mode
  // true = signup mode, false = login mode
  const [isSignup, setIsSignup] = useState(false);
  
  // State to store form input values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  
  // State to track if password should be visible
  const [showPassword, setShowPassword] = useState(false);
  
  // State to track if we're currently processing authentication
  const [isLoading, setIsLoading] = useState(false);
  
  // State to store and display error messages
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if username already exists
   * 
   * This function queries the users collection to check if a username is already taken.
   * Usernames are stored in lowercase for consistency.
   * 
   * @param username - The username to check (will be converted to lowercase)
   * @returns true if username exists, false otherwise
   */
  const checkUsernameExists = async (username: string): Promise<boolean> => {
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const usersRef = collection(db, collections.users);
      const usernameQuery = query(usersRef, where('username', '==', normalizedUsername));
      const querySnapshot = await getDocs(usernameQuery);
      return !querySnapshot.empty;
    } catch (error) {
      secureError('[Auth] Error checking username:', error);
      // If there's an error checking, we'll allow it to proceed (fail open)
      // This prevents blocking signups if there's a temporary Firestore issue
      return false;
    }
  };

  /**
   * Handle Form Submission
   * 
   * This function is called when the user submits the form.
   * It validates the input and either creates a new account or signs in.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent the default form submission behavior
    e.preventDefault();
    
    // Clear any previous errors
    setError(null);
    
    // Validate email format
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    // Basic email validation (check for @ symbol)
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Validate password
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }
    
    // If in signup mode, validate password length and confirmation, and required fields
    if (isSignup) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }
      
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      // Validate required signup fields
      if (!firstName.trim()) {
        setError('Please enter your first name');
        return;
      }
      
      if (!lastName.trim()) {
        setError('Please enter your last name');
        return;
      }
      
      if (!username.trim()) {
        setError('Please enter a username');
        return;
      }
      
      // Validate username format (alphanumeric and underscores, 3-20 characters)
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(username.trim())) {
        setError('Username must be 3-20 characters and contain only letters, numbers, and underscores');
        return;
      }
    }

    // Set loading state to show we're processing
    setIsLoading(true);

    // Check username uniqueness before creating account (only for signup)
    if (isSignup) {
      try {
        const usernameExists = await checkUsernameExists(username);
        if (usernameExists) {
          setError('This username is already taken. Please choose a different username.');
          setIsLoading(false);
          return;
        }
      } catch (error) {
        secureError('[Auth] Error checking username uniqueness:', error);
        setError('Unable to verify username availability. Please try again.');
        setIsLoading(false);
        return;
      }
    }

    try {
      let userCredential: { user: User };
      
      if (isSignup) {
        // Create a new user account
        // createUserWithEmailAndPassword returns a promise with user credentials
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        secureLog('[Auth] User account created successfully');
        
        // Create user profile in Firestore users collection
        try {
          const userProfileRef = doc(db, collections.users, userCredential.user.uid);
          await setDoc(userProfileRef, {
            uid: userCredential.user.uid,
            email: userCredential.user.email || email,
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            username: username.trim().toLowerCase() || null,
            createdAt: serverTimestamp(),
            lastActiveAt: serverTimestamp()
          });
          secureLog('[Auth] User profile created in Firestore');
        } catch (profileError) {
          // Log error but don't block authentication if profile creation fails
          secureError('[Auth] Error creating user profile:', profileError);
        }
      } else {
        // Sign in to an existing account
        // signInWithEmailAndPassword returns a promise with user credentials
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        secureLog('[Auth] User signed in successfully');
        
        // Check if user profile exists, create if it doesn't (for existing users)
        try {
          const userProfileRef = doc(db, collections.users, userCredential.user.uid);
          const userProfileSnap = await getDoc(userProfileRef);
          
          if (!userProfileSnap.exists()) {
            // Create profile for existing user who doesn't have one yet
            await setDoc(userProfileRef, {
              uid: userCredential.user.uid,
              email: userCredential.user.email || email,
              firstName: null,
              lastName: null,
              username: null,
              createdAt: serverTimestamp(),
              lastActiveAt: serverTimestamp()
            });
            secureLog('[Auth] User profile created for existing user');
          } else {
            // Update lastActiveAt for existing profile
            await setDoc(userProfileRef, {
              lastActiveAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (profileError) {
          // Log error but don't block authentication if profile update fails
          secureError('[Auth] Error updating user profile:', profileError);
        }
      }
      
      // Call the success callback with the authenticated user
      onAuthSuccess(userCredential.user);
      
      // Clear form fields
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      if (isSignup) {
        setFirstName('');
        setLastName('');
        setUsername('');
      }
    } catch (error: any) {
      // Handle authentication errors
      secureError('[Auth] Authentication error:', error);
      
      // Firebase provides specific error codes that we can use to show helpful messages
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.message) {
        // Use the error message if available
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      // Always set loading to false when done
      setIsLoading(false);
    }
  };

  /**
   * Toggle Between Signup and Login
   * 
   * This function switches between signup and login modes.
   * It also clears the form and any error messages.
   */
  const toggleMode = () => {
    setIsSignup(!isSignup);
    setError(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setUsername('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>K&N Meal Planner</h1>
          <p className="auth-subtitle">
            {isSignup ? 'Create your account' : 'Welcome back!'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Email Input */}
          <div className="form-group">
            <label htmlFor="email">Email Address {isSignup && '*'}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="auth-input"
              disabled={isLoading}
              autoComplete="email"
              required={isSignup}
            />
          </div>

          {/* First Name, Last Name, Username (only shown in signup mode) */}
          {isSignup && (
            <>
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  className="auth-input"
                  disabled={isLoading}
                  autoComplete="given-name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  className="auth-input"
                  disabled={isLoading}
                  autoComplete="family-name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="username">Username *</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username (3-20 characters)"
                  className="auth-input"
                  disabled={isLoading}
                  autoComplete="username"
                  minLength={3}
                  maxLength={20}
                  required
                />
                <small style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', display: 'block' }}>
                  Letters, numbers, and underscores only
                </small>
              </div>
            </>
          )}

          {/* Password Input */}
          <div className="form-group">
            <label htmlFor="password">Password {isSignup && '*'}</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="auth-input"
                disabled={isLoading}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required={isSignup}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Confirm Password Input (only shown in signup mode) */}
          {isSignup && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="auth-input"
                disabled={isLoading}
                autoComplete="new-password"
                required
              />
            </div>
          )}

          {/* Error Message Display */}
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : (isSignup ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        {/* Toggle Between Signup and Login */}
        <div className="auth-footer">
          <p>
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              className="auth-link-button"
              onClick={toggleMode}
              disabled={isLoading}
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;

