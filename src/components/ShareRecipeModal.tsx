// Import React hooks for managing component state
import React, { useState, useEffect } from 'react';

// Import Firebase and Firestore functions
import { db, collections, requireAuth } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { User } from 'firebase/auth';

// Import CSS for styling
import './ShareRecipeModal.css';

/**
 * UserProfile interface for the users collection
 */
interface UserProfile {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  createdAt: any;
  lastActiveAt?: any;
}

/**
 * ShareRecipeModal Component Props
 * 
 * This interface defines the props that the ShareRecipeModal component accepts.
 * - isOpen: Whether the modal is currently open
 * - onClose: Function to call when the modal should be closed
 * - recipe: The recipe to share
 * - currentUser: The current authenticated user
 */
interface ShareRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: {
    id?: string;
    name: string;
    userId: string;
    sharedWith?: string[];
    sharedAt?: any;  // Timestamp from Firestore
    visibility?: 'private' | 'shared' | 'public';
  } | null;
  currentUser: User | null;
}

/**
 * ShareRecipeModal Component
 * 
 * This component provides a modal interface for sharing recipes with other users.
 * It allows users to:
 * - View all registered users in a dropdown
 * - Select multiple users to share the recipe with
 * - See which users the recipe is already shared with
 * - Remove users from the shared list
 * 
 * Key Features:
 * - Multi-select user dropdown
 * - Real-time user list loading
 * - Error handling and display
 * - Loading states during operations
 */
const ShareRecipeModal: React.FC<ShareRecipeModalProps> = ({ 
  isOpen, 
  onClose, 
  recipe, 
  currentUser 
}) => {
  // State to store list of all users
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  // State to store currently selected user IDs (for sharing)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // State for search/filter input
  const [searchQuery, setSearchQuery] = useState('');
  
  // State to control dropdown visibility
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // State to track if we're currently loading users
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // State to track if we're currently saving changes
  const [isSaving, setIsSaving] = useState(false);
  
  // State to store and display error messages
  const [error, setError] = useState<string | null>(null);
  
  // State to store and display success messages
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * Load All Users
   * 
   * This function fetches all registered users from Firestore (excluding current user).
   * It runs when the modal opens.
   */
  useEffect(() => {
    if (isOpen && currentUser) {
      loadAllUsers();
      // Initialize selectedUserIds with currently shared users
      if (recipe?.sharedWith) {
        setSelectedUserIds([...recipe.sharedWith]);
      } else {
        setSelectedUserIds([]);
      }
      setError(null);
      setSuccess(null);
    } else {
      // Reset state when modal closes
      setAllUsers([]);
      setSelectedUserIds([]);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, currentUser, recipe]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isDropdownOpen && !target.closest('.user-search-dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  /**
   * Load All Users from Firestore
   * 
   * Fetches all user profiles except the current user.
   */
  const loadAllUsers = async () => {
    if (!currentUser) return;
    
    setIsLoadingUsers(true);
    setError(null);
    
    try {
      const currentUserAuth = requireAuth();
      const usersRef = collection(db, collections.users);
      
      // Get all users
      const usersSnapshot = await getDocs(usersRef);
      const usersList: UserProfile[] = [];
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data() as UserProfile;
        // Exclude current user from the list
        if (userData.uid !== currentUserAuth.uid) {
          usersList.push(userData);
        }
      });
      
      // Sort users by username, then by email if no username
      usersList.sort((a, b) => {
        const nameA = a.username || a.email;
        const nameB = b.username || b.email;
        return nameA.localeCompare(nameB);
      });
      
      setAllUsers(usersList);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  /**
   * Handle User Selection Toggle
   * 
   * This function is called when a user clicks on a user in the list.
   * It toggles the user's selection state.
   * 
   * @param userId - The ID of the user to toggle
   */
  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        // Remove user from selection
        return prev.filter(id => id !== userId);
      } else {
        // Add user to selection
        return [...prev, userId];
      }
    });
  };

  /**
   * Handle Save Sharing
   * 
   * This function is called when the user clicks the "Share" button.
   * It updates the recipe's sharedWith array in Firestore.
   */
  const handleSaveSharing = async () => {
    if (!recipe || !recipe.id || !currentUser) {
      setError('Invalid recipe or user');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const currentUserAuth = requireAuth();
      
      // Check if user owns the recipe
      if (recipe.userId !== currentUserAuth.uid) {
        setError('You can only share recipes that you own');
        setIsSaving(false);
        return;
      }

      const recipeRef = doc(db, collections.recipes, recipe.id);
      
      // Build update object - set the entire sharedWith array
      // Note: Per user's clarification, we don't remove user IDs when unsharing for future public sharing
      const updateData: any = {
        sharedWith: selectedUserIds.length > 0 ? selectedUserIds : [],
        updatedAt: serverTimestamp()
      };
      
      // Update visibility state
      if (selectedUserIds.length > 0) {
        updateData.visibility = 'shared';
        if (!recipe.sharedAt) {
          updateData.sharedAt = serverTimestamp();
        }
      } else {
        updateData.visibility = 'private';
      }
      
      // Perform the update
      await updateDoc(recipeRef, updateData);
      
      setSuccess('Recipe sharing updated successfully!');
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error updating recipe sharing:', err);
      setError('Failed to update sharing. Please try again.');
    } finally {
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
    setSelectedUserIds([]);
    setSearchQuery('');
    setIsDropdownOpen(false);
    setError(null);
    setSuccess(null);
    onClose();
  };

  /**
   * Get User Display Name
   * 
   * Helper function to get a user's username or email.
   * 
   * @param user - The user profile
   * @returns Username or email
   */
  const getUserDisplayName = (user: UserProfile): string => {
    return user.username || user.email;
  };

  /**
   * Get Full User Name
   * 
   * Helper function to get a user's full name (firstName + lastName) or username.
   * 
   * @param user - The user profile
   * @returns Full name or username
   */
  const getUserFullName = (user: UserProfile): string => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email;
  };

  /**
   * Filter users based on search query
   * 
   * Filters users by username (case-insensitive).
   */
  const filteredUsers = allUsers.filter(user => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const username = (user.username || '').toLowerCase();
    const fullName = getUserFullName(user).toLowerCase();
    return username.includes(query) || fullName.includes(query);
  });

  // Don't render anything if modal is not open or recipe is not provided
  if (!isOpen || !recipe) return null;

  return (
    <div className="share-recipe-overlay" onClick={handleClose}>
      <div className="share-recipe-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-recipe-header">
          <h2>Share Recipe: {recipe.name}</h2>
          <button
            className="close-modal-button"
            onClick={handleClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="share-recipe-content">
          {/* Instructions */}
          <p className="share-instructions">
            Search for users by username and select multiple users to share this recipe with.
          </p>

          {/* Loading State */}
          {isLoadingUsers && (
            <div className="loading-message">
              Loading users...
            </div>
          )}

          {/* Searchable Dropdown */}
          {!isLoadingUsers && (
            <div className="user-search-dropdown-container">
              <div className="user-search-input-wrapper">
                <input
                  type="text"
                  className="user-search-input"
                  placeholder="Type username to search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  disabled={allUsers.length === 0}
                />
                <span className="dropdown-arrow" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  {isDropdownOpen ? '▲' : '▼'}
                </span>
              </div>

              {/* Dropdown List */}
              {isDropdownOpen && allUsers.length > 0 && (
                <div className="user-dropdown-list">
                  {filteredUsers.length === 0 ? (
                    <div className="no-results-message">
                      No users found matching "{searchQuery}"
                    </div>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelected = selectedUserIds.includes(user.uid);
                      return (
                        <div
                          key={user.uid}
                          className={`user-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleUserToggle(user.uid)}
                        >
                          <div className="user-checkbox">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleUserToggle(user.uid)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="user-info">
                            <div className="user-name">
                              {user.username ? `@${user.username}` : user.email}
                            </div>
                            {user.firstName && user.lastName && (
                              <div className="user-full-name">
                                {user.firstName} {user.lastName}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {allUsers.length === 0 && (
                <div className="no-users-message">
                  No other users found. Share recipes once more users sign up!
                </div>
              )}
            </div>
          )}

          {/* Selected Count */}
          {selectedUserIds.length > 0 && (
            <div className="selected-count">
              {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
            </div>
          )}

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
              type="button"
              className="share-button"
              onClick={handleSaveSharing}
              disabled={isSaving || isLoadingUsers}
            >
              {isSaving ? 'Saving...' : 'Share Recipe'}
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
        </div>
      </div>
    </div>
  );
};

export default ShareRecipeModal;

