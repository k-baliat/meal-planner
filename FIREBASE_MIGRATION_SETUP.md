# Firebase Migration Setup Guide - Step 1: Configuration

This guide walks you through configuring Firebase Admin SDK for the data migration script. Follow these steps carefully to ensure a secure and successful migration.

## Prerequisites

- Access to your Firebase Console
- Node.js installed (version 16 or higher)
- Your Firebase project already set up

---

## Step 1: Get Your Firebase Project Information

### 1.1 Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (the one used by your meal planner app)

### 1.2 Get Your Project ID

1. In Firebase Console, click the **gear icon** (⚙️) next to "Project Overview"
2. Select **"Project settings"**
3. In the **"General"** tab, find **"Project ID"**
4. **Copy this value** - you'll need it later
   - Example: `my-meal-planner-app`

### 1.3 Verify Your Current Environment Variables

Check if you have a `.env` file in your project root. If not, we'll create one.

**Location**: `/Users/kevinbaliat/Desktop/Projects/meal_planner_app/meal_planner_app/.env`

Your `.env` file should already contain your client-side Firebase config (for the React app):
```env
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

**Note**: We'll add Admin SDK credentials separately (not in `.env` for security reasons).

---

## Step 2: Generate Service Account Key (Firebase Admin SDK)

The Service Account Key allows the migration script to access your Firestore database with admin privileges.

### 2.1 Navigate to Service Accounts

1. In Firebase Console, go to **Project Settings** (gear icon ⚙️)
2. Click on the **"Service accounts"** tab
3. You should see a section titled **"Firebase Admin SDK"**

### 2.2 Generate New Private Key

1. In the "Firebase Admin SDK" section, click **"Generate new private key"** button
2. A warning dialog will appear - click **"Generate key"**
3. A JSON file will be downloaded to your computer
   - **File name format**: `your-project-name-firebase-adminsdk-xxxxx-xxxxxxxxxx.json`
   - **IMPORTANT**: This file contains sensitive credentials - treat it like a password!

### 2.3 Secure the Service Account Key

**CRITICAL SECURITY STEPS:**

1. **Create a secure location** for the key file:
   ```bash
   # Create a directory for Firebase credentials (outside your project)
   mkdir -p ~/.firebase-credentials
   ```

2. **Move the downloaded JSON file** to this secure location:
   ```bash
   # Move the file (replace with your actual filename)
   mv ~/Downloads/your-project-name-firebase-adminsdk-xxxxx-xxxxxxxxxx.json ~/.firebase-credentials/service-account-key.json
   ```

3. **Set proper permissions** (only you can read it):
   ```bash
   chmod 600 ~/.firebase-credentials/service-account-key.json
   ```

4. **Add to .gitignore** (if not already there):
   ```bash
   # Add this line to your .gitignore file
   echo "~/.firebase-credentials/" >> .gitignore
   echo "service-account-key.json" >> .gitignore
   echo "*-firebase-adminsdk-*.json" >> .gitignore
   ```

### 2.4 Verify Service Account Key Structure

Open the JSON file to verify it has the correct structure. It should look like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "xxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "xxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**✅ If your file looks like this, you're good to proceed!**

---

## Step 3: Get Your User ID (UID)

You need the User ID of the account that will "own" all the existing data after migration.

### 3.1 Option A: If You Already Have an Account

1. Sign in to your app with your email/password
2. Open browser console (F12)
3. Run this command:
   ```javascript
   // In browser console
   firebase.auth().currentUser.uid
   ```
4. **Copy the UID** - it looks like: `abc123def456ghi789`

### 3.2 Option B: Create a New Account for Migration

1. Sign up in your app with the email you want to use
2. Follow Option A steps above to get the UID

### 3.3 Option C: Get UID from Firebase Console

1. Go to Firebase Console > **Authentication** > **Users**
2. Find your user account
3. Click on the user
4. **Copy the "User UID"** value

**Save this UID** - you'll need it for the migration script.

---

## Step 4: Install Firebase Admin SDK

The Firebase Admin SDK is already in your `package.json`, but let's verify it's installed:

```bash
# Navigate to your project directory
cd /Users/kevinbaliat/Desktop/Projects/meal_planner_app/meal_planner_app

# Install dependencies (if not already done)
npm install

# Verify firebase-admin is installed
npm list firebase-admin
```

You should see `firebase-admin@13.6.0` (or similar version) in the output.

---

## Step 5: Create Migration Script Directory Structure

Let's organize the migration scripts properly:

```bash
# Create scripts directory if it doesn't exist
mkdir -p scripts

# Create a secure directory for credentials (optional, if you want to keep it in project)
# NOTE: This is less secure than ~/.firebase-credentials, but more convenient
# If you use this, make sure it's in .gitignore!
mkdir -p scripts/credentials
```

---

## Step 6: Update Migration Script with Your Configuration

We'll create a properly configured migration script. The script will:

1. Load the service account key from the secure location
2. Use your User ID
3. Include proper error handling

**Next Steps:**
- I'll create the migration script with your specific paths
- The script will use the service account key from `~/.firebase-credentials/service-account-key.json`
- You'll need to provide your User ID when running the script

---

## Step 7: Verify Your Setup

Before proceeding, verify you have:

- [ ] ✅ Service account key JSON file downloaded
- [ ] ✅ Service account key moved to secure location (`~/.firebase-credentials/service-account-key.json`)
- [ ] ✅ File permissions set to 600 (read/write for owner only)
- [ ] ✅ Service account key added to `.gitignore`
- [ ] ✅ Your User ID (UID) copied and saved
- [ ] ✅ Firebase Admin SDK installed (`npm list firebase-admin` shows version)
- [ ] ✅ Your Firebase Project ID noted

---

## Security Checklist

Before running any migration:

- [ ] ✅ Service account key is **NOT** in your project directory (unless in `.gitignore`)
- [ ] ✅ Service account key is **NOT** committed to Git
- [ ] ✅ Service account key has restricted permissions (600)
- [ ] ✅ You understand that the service account has **full admin access** to your database

---

## Troubleshooting

### Issue: "Cannot find module 'firebase-admin'"
**Solution**: Run `npm install firebase-admin`

### Issue: "Service account key file not found"
**Solution**: 
- Verify the file path is correct
- Check file permissions: `ls -la ~/.firebase-credentials/service-account-key.json`
- Should show: `-rw-------` (600 permissions)

### Issue: "Permission denied" when accessing service account key
**Solution**: 
```bash
chmod 600 ~/.firebase-credentials/service-account-key.json
```

### Issue: "Invalid service account credentials"
**Solution**:
- Verify the JSON file is valid (open it and check structure)
- Make sure you downloaded the correct key from Firebase Console
- Try generating a new key if the current one doesn't work

---

## What's Next?

Once you've completed all the steps above and verified your setup:

1. **Inform me** that Step 1 is complete
2. I'll proceed with **Step 2**: Creating the migration script with comprehensive guardrails to prevent data loss
3. The migration script will include:
   - Automatic backups
   - Dry-run mode (test without making changes)
   - Rollback capabilities
   - Detailed logging
   - Error recovery

---

## Quick Reference

**Service Account Key Location:**
```
~/.firebase-credentials/service-account-key.json
```

**Your Project Structure:**
```
meal_planner_app/
├── .env                    # Client-side Firebase config (already exists)
├── scripts/
│   └── migrate-data.js    # Migration script (we'll create this)
└── package.json           # Dependencies (firebase-admin already included)
```

**Key Values You Need:**
- Project ID: `[from Firebase Console > Project Settings > General]`
- User ID (UID): `[from Authentication > Users, or browser console]`
- Service Account Key Path: `~/.firebase-credentials/service-account-key.json`

---

**Ready to proceed?** Complete all the steps above, then let me know when you're ready for Step 2 (creating the safe migration script with guardrails).

