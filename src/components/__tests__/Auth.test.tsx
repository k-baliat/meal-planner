/**
 * Authentication Component Tests
 * 
 * These tests verify that the authentication system works correctly.
 * Tests include sign up, sign in, error handling, and form validation.
 * 
 * Test Credentials:
 * - Email: cursor_test@testing.com
 * - Password: 123456
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Auth from '../Auth';
import { auth } from '../../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

// Mock Firebase instance
jest.mock('../../firebase', () => ({
  auth: {},
}));

// Test credentials
const TEST_EMAIL = 'cursor_test@testing.com';
const TEST_PASSWORD = '123456';

describe('Auth Component', () => {
  // Mock user object
  const mockUser = {
    uid: 'test-user-id',
    email: TEST_EMAIL,
    emailVerified: true,
  } as any;

  // Mock onAuthSuccess callback
  const mockOnAuthSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sign Up Flow', () => {
    it('should render sign up form when in signup mode', () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      // Click to switch to signup mode
      const signUpLink = screen.getByText(/sign up/i);
      fireEvent.click(signUpLink);
      
      // Check for signup-specific elements
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const signUpLink = screen.getByText(/sign up/i);
      fireEvent.click(signUpLink);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up/i });
      
      // Enter invalid email
      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.type(passwordInput, TEST_PASSWORD);
      await userEvent.type(confirmPasswordInput, TEST_PASSWORD);
      await userEvent.click(submitButton);
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      });
    });

    it('should validate password length', async () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const signUpLink = screen.getByText(/sign up/i);
      fireEvent.click(signUpLink);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up/i });
      
      // Enter short password
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.type(passwordInput, '12345'); // Too short
      await userEvent.type(confirmPasswordInput, '12345');
      await userEvent.click(submitButton);
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate password match', async () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const signUpLink = screen.getByText(/sign up/i);
      fireEvent.click(signUpLink);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up/i });
      
      // Enter mismatched passwords
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.type(passwordInput, TEST_PASSWORD);
      await userEvent.type(confirmPasswordInput, 'different-password');
      await userEvent.click(submitButton);
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should successfully create user account', async () => {
      // Mock successful signup
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser
      });

      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const signUpLink = screen.getByText(/sign up/i);
      fireEvent.click(signUpLink);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up/i });
      
      // Fill in form
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.type(passwordInput, TEST_PASSWORD);
      await userEvent.type(confirmPasswordInput, TEST_PASSWORD);
      await userEvent.click(submitButton);
      
      // Wait for authentication
      await waitFor(() => {
        expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
          auth,
          TEST_EMAIL,
          TEST_PASSWORD
        );
        expect(mockOnAuthSuccess).toHaveBeenCalledWith(mockUser);
      });
    });

    it('should handle signup errors', async () => {
      // Mock signup error
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'Email already in use'
      });

      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const signUpLink = screen.getByText(/sign up/i);
      fireEvent.click(signUpLink);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up/i });
      
      // Fill in form
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.type(passwordInput, TEST_PASSWORD);
      await userEvent.type(confirmPasswordInput, TEST_PASSWORD);
      await userEvent.click(submitButton);
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/already registered/i)).toBeInTheDocument();
      });
    });
  });

  describe('Sign In Flow', () => {
    it('should render sign in form by default', () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    });

    it('should successfully sign in user', async () => {
      // Mock successful signin
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser
      });

      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Fill in form
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.type(passwordInput, TEST_PASSWORD);
      await userEvent.click(submitButton);
      
      // Wait for authentication
      await waitFor(() => {
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
          auth,
          TEST_EMAIL,
          TEST_PASSWORD
        );
        expect(mockOnAuthSuccess).toHaveBeenCalledWith(mockUser);
      });
    });

    it('should handle signin errors', async () => {
      // Mock signin error
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Wrong password'
      });

      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Fill in form
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.type(passwordInput, 'wrong-password');
      await userEvent.click(submitButton);
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
      });
    });

    it('should handle user not found error', async () => {
      // Mock user not found error
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/user-not-found',
        message: 'User not found'
      });

      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Fill in form
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.type(passwordInput, TEST_PASSWORD);
      await userEvent.click(submitButton);
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/no account found/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI Interactions', () => {
    it('should toggle between sign in and sign up', () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      // Initially in sign in mode
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      
      // Switch to sign up
      const signUpLink = screen.getByText(/sign up/i);
      fireEvent.click(signUpLink);
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
      
      // Switch back to sign in
      const signInLink = screen.getByText(/sign in/i);
      fireEvent.click(signInLink);
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should toggle password visibility', async () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const passwordInput = screen.getByLabelText(/^password$/i);
      const toggleButton = screen.getByLabelText(/show password/i);
      
      // Password should be hidden by default
      expect(passwordInput).toHaveAttribute('type', 'password');
      
      // Click to show password
      await userEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Click to hide password
      await userEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should disable submit button while loading', async () => {
      // Mock slow signin
      (signInWithEmailAndPassword as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ user: mockUser }), 100))
      );

      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Fill in form
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.type(passwordInput, TEST_PASSWORD);
      await userEvent.click(submitButton);
      
      // Button should be disabled and show loading state
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should require email field', async () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Try to submit without email
      await userEvent.type(passwordInput, TEST_PASSWORD);
      await userEvent.click(submitButton);
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/enter your email/i)).toBeInTheDocument();
      });
    });

    it('should require password field', async () => {
      render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Try to submit without password
      await userEvent.type(emailInput, TEST_EMAIL);
      await userEvent.click(submitButton);
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
      });
    });
  });
});

