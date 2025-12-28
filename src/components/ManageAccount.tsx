// Import React hooks for managing component state
import React, { useState, useEffect } from 'react';

// Import Firebase and Firestore functions
import { db, collections, requireAuth } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';

// Import CSS for styling
import './ManageAccount.css';

/**
 * ManageAccount Component Props
 * 
 * This interface defines the props that the ManageAccount component accepts.
 * - isOpen: Whether the modal is currently open
 * - onClose: Function to call when the modal should be closed
 * - user: The current authenticated user
 */
interface ManageAccountProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

/**
 * ManageAccount Component
 * 
 * This component provides a modal interface for users to manage their account profile.
 * It allows users to:
 * - View and update their first name, last name, and username
 * - View their email address (read-only)
 * 
 * Key Features:
 * - Form validation
 * - Error handling and display
 * - Loading states during updates
 * - Auto-loads existing profile data
 */
const ManageAccount: React.FC<ManageAccountProps> = ({ isOpen, onClose, user }) => {
  // State to store form input values
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  
  // State to track if we're currently loading profile data
  const [isLoading, setIsLoading] = useState(false);
  
  // State to track if we're currently saving changes
  const [isSaving, setIsSaving] = useState(false);
  
  // State to store and display error messages
  const [error, setError] = useState<string | null>(null);
  
  // State to store and display success messages
  const [success, setSuccess] = useState<string | null>(null);
  
  // State to store current username (to check if it changed)
  const [currentUsername, setCurrentUsername] = useState<string>('');

  /**
   * Check if username already exists
   * 
   * This function queries the users collection to check if a username is already taken.
   * Usernames are stored in lowercase for consistency.
   * 
   * @param username - The username to check (will be converted to lowercase)
   * @param excludeUserId - User ID to exclude from the check (current user's ID)
   * @returns true if username exists, false otherwise
   */
  const checkUsernameExists = async (username: string, excludeUserId?: string): Promise<boolean> => {
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const usersRef = collection(db, collections.users);
      const usernameQuery = query(usersRef, where('username', '==', normalizedUsername));
      const querySnapshot = await getDocs(usernameQuery);
      
      // Check if any user (other than the current user) has this username
      let exists = false;
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        // If excludeUserId is provided, skip the current user
        if (!excludeUserId || userData.uid !== excludeUserId) {
          exists = true;
        }
      });
      
      return exists;
    } catch (error) {
      console.error('Error checking username:', error);
      // If there's an error checking, we'll allow it to proceed (fail open)
      // This prevents blocking updates if there's a temporary Firestore issue
      return false;
    }
  };

  /**
   * Load User Profile
   * 
   * This function fetches the user's profile from Firestore and populates the form.
   * It runs when the modal opens or when the user changes.
   */
  useEffect(() => {
    if (isOpen && user) {
      loadUserProfile();
    } else {
      // Reset form when modal closes
      setFirstName('');
      setLastName('');
      setUsername('');
      setCurrentUsername('');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, user]);

  /**
   * Load User Profile from Firestore
   * 
   * Fetches the user's profile document and populates the form fields.
   */
  const loadUserProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const currentUser = requireAuth();
      const userProfileRef = doc(db, collections.users, currentUser.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      
      if (userProfileSnap.exists()) {
        const profileData = userProfileSnap.data();
        setFirstName(profileData.firstName || '');
        setLastName(profileData.lastName || '');
        const existingUsername = profileData.username || '';
        setUsername(existingUsername);
        setCurrentUsername(existingUsername); // Store current username for comparison
      } else {
        // Profile doesn't exist yet, create it
        await setDoc(userProfileRef, {
          uid: currentUser.uid,
          email: currentUser.email || '',
          firstName: null,
          lastName: null,
          username: null,
          createdAt: serverTimestamp(),
          lastActiveAt: serverTimestamp()
        });
        setFirstName('');
        setLastName('');
        setUsername('');
      }
    } catch (err: any) {
      console.error('Error loading user profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Form Submission
   * 
   * This function is called when the user submits the form.
   * It validates the input and updates the user profile in Firestore.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent the default form submission behavior
    e.preventDefault();
    
    // Clear any previous errors or success messages
    setError(null);
    setSuccess(null);
    
    if (!user) {
      setError('User not authenticated');
      return;
    }

    // Validate username if provided
    if (username.trim()) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(username.trim())) {
        setError('Username must be 3-20 characters and contain only letters, numbers, and underscores');
        setIsSaving(false);
        return;
      }
      
      // Check if username has changed
      const normalizedNewUsername = username.trim().toLowerCase();
      const normalizedCurrentUsername = currentUsername.toLowerCase();
      
      // Only check uniqueness if the username has changed
      if (normalizedNewUsername !== normalizedCurrentUsername) {
        try {
          const currentUser = requireAuth();
          const usernameExists = await checkUsernameExists(username, currentUser.uid);
          if (usernameExists) {
            setError('This username is already taken. Please choose a different username.');
            setIsSaving(false);
            return;
          }
        } catch (error) {
          console.error('Error checking username uniqueness:', error);
          setError('Unable to verify username availability. Please try again.');
          setIsSaving(false);
          return;
        }
      }
    }

    // Set saving state to show we're processing
    setIsSaving(true);

    try {
      const currentUser = requireAuth();
      const userProfileRef = doc(db, collections.users, currentUser.uid);
      
      // Update the user profile with new fields
      const normalizedUsername = username.trim().toLowerCase() || null;
      await setDoc(userProfileRef, {
        uid: currentUser.uid,
        email: currentUser.email || '',
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        username: normalizedUsername,
        lastActiveAt: serverTimestamp()
      }, { merge: true });
      
      // Update current username if it changed
      if (normalizedUsername) {
        setCurrentUsername(normalizedUsername);
      }
      
      setSuccess('Profile updated successfully!');
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      // Always set saving to false when done
      setIsSaving(false);
    }
  };

  /**
   * Handle Modal Close
   * 
   * This function is called when the user clicks outside the modal or the close button.
   * It resets the form and closes the modal.
   */
  const handleClose = () => {
    setFirstName('');
    setLastName('');
    setUsername('');
    setCurrentUsername('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  return (
    <div className="manage-account-overlay" onClick={handleClose}>
      <div className="manage-account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manage-account-header">
          <h2>Manage Account</h2>
          <button
            className="close-modal-button"
            onClick={handleClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="manage-account-form">
          {/* Email Display (Read-only) */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={user?.email || ''}
              className="manage-account-input"
              disabled
              readOnly
            />
            <small className="form-help-text">Email cannot be changed</small>
          </div>

          {/* First Name Input */}
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              className="manage-account-input"
              disabled={isLoading || isSaving}
              maxLength={50}
            />
          </div>

          {/* Last Name Input */}
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              className="manage-account-input"
              disabled={isLoading || isSaving}
              maxLength={50}
            />
          </div>

          {/* Username Input */}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username (3-20 characters)"
              className="manage-account-input"
              disabled={isLoading || isSaving}
              minLength={3}
              maxLength={20}
            />
            <small className="form-help-text">
              Letters, numbers, and underscores only. This is how other users will find you when sharing recipes.
            </small>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          {/* Success Message Display */}
          {success && (
            <div className="success-message" role="alert">
              {success}
            </div>
          )}

          {/* Form Buttons */}
          <div className="form-buttons">
            <button
              type="submit"
              className="save-button"
              disabled={isLoading || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManageAccount;

