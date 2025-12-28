/**
 * Authentication Test Page Component
 * 
 * This component provides a simple interface for testing authentication
 * without needing to use the browser console.
 * 
 * Usage: Add this component temporarily to your App.tsx for testing
 */

import React, { useState } from 'react';
import { testSignUp, testSignIn, testSignOut, testGetCurrentUser, runAllAuthTests } from '../utils/authTestHelpers';
import './AuthTestPage.css';

const AuthTestPage: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Add a log to test results
  const addLog = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Clear console logs
  const clearLogs = () => {
    setTestResults([]);
  };

  // Test Sign Up
  const handleTestSignUp = async () => {
    setIsRunning(true);
    addLog('Starting Sign Up test...');
    try {
      const user = await testSignUp();
      addLog(`✅ Sign Up successful! User ID: ${user.uid}`);
      setCurrentUser(user);
    } catch (error: any) {
      addLog(`❌ Sign Up failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Test Sign In
  const handleTestSignIn = async () => {
    setIsRunning(true);
    addLog('Starting Sign In test...');
    try {
      const user = await testSignIn();
      addLog(`✅ Sign In successful! User ID: ${user.uid}`);
      setCurrentUser(user);
    } catch (error: any) {
      addLog(`❌ Sign In failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Test Sign Out
  const handleTestSignOut = async () => {
    setIsRunning(true);
    addLog('Starting Sign Out test...');
    try {
      await testSignOut();
      addLog('✅ Sign Out successful!');
      setCurrentUser(null);
    } catch (error: any) {
      addLog(`❌ Sign Out failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Get Current User
  const handleGetCurrentUser = () => {
    const user = testGetCurrentUser();
    if (user) {
      addLog(`✅ Current user: ${user.email} (${user.uid})`);
      setCurrentUser(user);
    } else {
      addLog('ℹ️ No user is currently authenticated');
      setCurrentUser(null);
    }
  };

  // Run All Tests
  const handleRunAllTests = async () => {
    setIsRunning(true);
    clearLogs();
    addLog('🚀 Starting complete test suite...');
    
    // Override console.log to capture test output
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args: any[]) => {
      originalLog(...args);
      addLog(args.join(' '));
    };
    
    console.error = (...args: any[]) => {
      originalError(...args);
      addLog(`ERROR: ${args.join(' ')}`);
    };
    
    try {
      await runAllAuthTests();
      addLog('✅ All tests completed!');
    } catch (error: any) {
      addLog(`❌ Test suite failed: ${error.message}`);
    } finally {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      setIsRunning(false);
      handleGetCurrentUser();
    }
  };

  return (
    <div className="auth-test-page">
      <div className="auth-test-container">
        <h1>🔐 Authentication Test Page</h1>
        <p className="test-credentials">
          <strong>Test Credentials:</strong><br />
          Email: cursor_test@testing.com<br />
          Password: 123456
        </p>

        <div className="test-buttons">
          <button
            onClick={handleTestSignUp}
            disabled={isRunning}
            className="test-button test-button-signup"
          >
            Test Sign Up
          </button>
          <button
            onClick={handleTestSignIn}
            disabled={isRunning}
            className="test-button test-button-signin"
          >
            Test Sign In
          </button>
          <button
            onClick={handleTestSignOut}
            disabled={isRunning}
            className="test-button test-button-signout"
          >
            Test Sign Out
          </button>
          <button
            onClick={handleGetCurrentUser}
            disabled={isRunning}
            className="test-button test-button-getuser"
          >
            Get Current User
          </button>
          <button
            onClick={handleRunAllTests}
            disabled={isRunning}
            className="test-button test-button-all"
          >
            Run All Tests
          </button>
          <button
            onClick={clearLogs}
            disabled={isRunning}
            className="test-button test-button-clear"
          >
            Clear Logs
          </button>
        </div>

        {currentUser && (
          <div className="current-user-info">
            <h3>Current User:</h3>
            <p><strong>Email:</strong> {currentUser.email}</p>
            <p><strong>UID:</strong> {currentUser.uid}</p>
            <p><strong>Email Verified:</strong> {currentUser.emailVerified ? 'Yes' : 'No'}</p>
          </div>
        )}

        <div className="test-results">
          <h3>Test Results:</h3>
          <div className="test-results-log">
            {testResults.length === 0 ? (
              <p className="no-results">No test results yet. Click a button above to run tests.</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="test-result-line">
                  {result}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthTestPage;

