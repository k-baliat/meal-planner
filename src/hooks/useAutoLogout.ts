// Import React hooks for managing side effects
// useEffect allows us to perform side effects when component mounts or dependencies change
import { useEffect, useRef } from 'react';

// Import Firebase authentication functions
import { signOut } from '../firebase';

/**
 * useAutoLogout Hook
 * 
 * This custom hook implements automatic logout after a period of inactivity.
 * It monitors user activity (mouse movements, clicks, keyboard presses, etc.)
 * and automatically signs the user out if they're inactive for the specified duration.
 * 
 * Features:
 * - Tracks user activity across multiple event types
 * - Resets the inactivity timer on any user activity
 * - Automatically signs out after the inactivity period
 * - Cleans up event listeners when component unmounts
 * 
 * @param timeoutMinutes - Number of minutes of inactivity before auto-logout (default: 30)
 * @param onLogout - Optional callback function to call when auto-logout occurs
 * 
 * @example
 * // Auto-logout after 30 minutes of inactivity
 * useAutoLogout(30);
 * 
 * // Auto-logout after 15 minutes with a callback
 * useAutoLogout(15, () => {
 *   console.log('User was automatically logged out');
 * });
 */
export const useAutoLogout = (
  timeoutMinutes: number = 30,
  onLogout?: () => void
) => {
  // Use useRef to store the timeout ID so we can clear it when needed
  // useRef persists across re-renders but doesn't cause re-renders when changed
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Reset Inactivity Timer
   * 
   * This function clears any existing timeout and starts a new one.
   * It's called whenever user activity is detected.
   */
  const resetTimer = () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a new timeout for the specified number of minutes
    // Convert minutes to milliseconds (minutes * 60 seconds * 1000 milliseconds)
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    timeoutRef.current = setTimeout(async () => {
      try {
        // Sign out the user
        await signOut();
        
        // Call the optional callback if provided
        if (onLogout) {
          onLogout();
        }
        
        console.log(`Auto-logged out after ${timeoutMinutes} minutes of inactivity`);
      } catch (error) {
        console.error('Error during auto-logout:', error);
      }
    }, timeoutMs);
  };

  /**
   * Setup Activity Listeners
   * 
   * This effect runs when the component mounts and sets up event listeners
   * to detect user activity. It also sets up the initial inactivity timer.
   */
  useEffect(() => {
    // List of events that indicate user activity
    // We listen to multiple events to catch all types of user interaction
    const activityEvents = [
      'mousedown',    // Mouse clicks
      'mousemove',    // Mouse movements
      'keypress',     // Keyboard presses
      'scroll',       // Scrolling
      'touchstart',   // Touch events (for mobile)
      'click'         // Click events
    ];

    // Add event listeners for each activity event
    // We use document to catch activity anywhere on the page
    activityEvents.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    // Start the initial timer
    resetTimer();

    // Cleanup function - runs when component unmounts or dependencies change
    return () => {
      // Remove all event listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });

      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [timeoutMinutes]); // Re-run if timeoutMinutes changes
};

