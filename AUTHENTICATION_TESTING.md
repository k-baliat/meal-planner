# Authentication Testing Guide

This guide explains how to test the authentication system using the provided test scripts and tools.

## Test Credentials

- **Email**: `cursor_test@testing.com`
- **Password**: `123456`

## Testing Methods

### Method 1: Automated Unit Tests (Recommended)

Run the Jest test suite:

```bash
npm test -- src/components/__tests__/Auth.test.tsx
```

Or run all tests:

```bash
npm test
```

**What it tests:**
- Sign up form validation
- Sign in functionality
- Error handling
- Password visibility toggle
- Form validation
- UI interactions

### Method 2: Browser Console Testing

1. Start your development server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to the app

3. Open the browser console (F12 or Cmd+Option+I)

4. Import and use the test helpers:

```javascript
// If using ES6 modules, you can import:
import { testSignUp, testSignIn, testSignOut, runAllAuthTests } from './utils/authTestHelpers';

// Or use the console script:
// Copy the contents of scripts/test-auth-console.js into the console
```

5. Run tests:

```javascript
// Test sign up
testSignUp();

// Test sign in
testSignIn();

// Test sign out
testSignOut();

// Get current user
testGetCurrentUser();

// Run all tests
runAllAuthTests();
```

### Method 3: Test Page Component

1. Temporarily add the AuthTestPage component to your App.tsx:

```typescript
import AuthTestPage from './components/AuthTestPage';

// In your App component, temporarily show the test page:
if (process.env.NODE_ENV === 'development') {
  return <AuthTestPage />;
}
```

2. The test page provides a UI with buttons to test all authentication functions

3. Results are displayed in real-time

### Method 4: Manual Testing via UI

1. Start your development server:
   ```bash
   npm start
   ```

2. Navigate to the app - you should see the login screen

3. Test Sign Up:
   - Click "Sign Up" link
   - Enter: `cursor_test@testing.com`
   - Enter password: `123456`
   - Confirm password: `123456`
   - Click "Sign Up" button

4. Test Sign In:
   - If already signed up, use the same credentials
   - Enter email and password
   - Click "Sign In" button

5. Test Sign Out:
   - Once signed in, click the "Sign Out" button in the banner

## Test Scenarios

### Scenario 1: New User Sign Up
1. Ensure you're signed out
2. Click "Sign Up"
3. Enter test credentials
4. Verify account is created
5. Verify you're automatically signed in

### Scenario 2: Existing User Sign In
1. Ensure account exists (from Scenario 1)
2. Sign out if signed in
3. Click "Sign In"
4. Enter test credentials
5. Verify successful sign in

### Scenario 3: Error Handling
1. Try signing in with wrong password
2. Verify error message appears
3. Try signing up with existing email
4. Verify appropriate error message

### Scenario 4: Form Validation
1. Try submitting empty form
2. Try submitting with invalid email
3. Try submitting with short password (< 6 characters)
4. Try submitting with mismatched passwords
5. Verify all validation errors appear

### Scenario 5: Auto-Logout
1. Sign in
2. Wait 30 minutes without activity
3. Verify automatic logout
4. Verify redirect to login screen

## Common Issues and Solutions

### Issue: "Email already in use"
**Solution**: The account already exists. Use `testSignIn()` instead of `testSignUp()`, or delete the user from Firebase Console.

### Issue: "User not found"
**Solution**: The account doesn't exist. Run `testSignUp()` first to create the account.

### Issue: "Wrong password"
**Solution**: Make sure you're using the correct password: `123456`

### Issue: Firebase not initialized
**Solution**: 
- Check that your `.env` file has all required Firebase configuration
- Verify Firebase project is set up correctly
- Check browser console for Firebase initialization errors

### Issue: "Too many requests"
**Solution**: Wait a few minutes before trying again. Firebase has rate limiting for security.

## Cleaning Up Test Data

To remove the test user from Firebase:

1. Go to Firebase Console
2. Navigate to Authentication > Users
3. Find `cursor_test@testing.com`
4. Click the three dots menu
5. Select "Delete user"

Or use Firebase CLI:

```bash
firebase auth:export users.json
# Edit users.json to remove test user
firebase auth:import users.json
```

## Test Coverage

The test suite covers:

- ✅ Sign up with valid credentials
- ✅ Sign up with invalid email
- ✅ Sign up with weak password
- ✅ Sign up with mismatched passwords
- ✅ Sign in with valid credentials
- ✅ Sign in with wrong password
- ✅ Sign in with non-existent user
- ✅ Sign out functionality
- ✅ Password visibility toggle
- ✅ Form validation
- ✅ Error message display
- ✅ Loading states
- ✅ Authentication state monitoring

## Next Steps

After testing:

1. **Enable Email/Password in Firebase Console**:
   - Go to Firebase Console > Authentication > Sign-in method
   - Enable "Email/Password" provider

2. **Deploy Security Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Test in Production**:
   - Build the app: `npm run build`
   - Deploy to your hosting platform
   - Test authentication in production environment

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Firebase Console for authentication errors
3. Verify environment variables are set correctly
4. Review the error messages - they provide helpful guidance

