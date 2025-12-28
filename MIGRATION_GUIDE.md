# Data Migration Guide

This guide explains how to migrate your existing single-user meal planner data to support multiple users with authentication.

## Overview

The migration process involves:
1. Adding `userId` fields to all existing documents
2. Ensuring all documents are associated with a user account
3. Updating document IDs to include user IDs where necessary

## Migration Strategy

### Option 1: Manual Migration via Firebase Console (Recommended for Small Datasets)

1. **Enable Email/Password Authentication in Firebase Console**
   - Go to Firebase Console > Authentication > Sign-in method
   - Enable "Email/Password" provider

2. **Create a Migration User Account**
   - Sign up with the email/password you want to use for existing data
   - Note the User ID (UID) from Firebase Console > Authentication

3. **Update Existing Documents**
   - Go to Firebase Console > Firestore Database
   - For each collection (recipes, mealPlans, shoppingLists, notes):
     - Open each document
     - Add a field: `userId` (string) with the value of your UID
     - Save the document

4. **Update Document IDs for Meal Plans and Shopping Lists**
   - These collections now use document IDs in the format: `{userId}_{weekRange}`
   - You'll need to:
     - Create new documents with the new ID format
     - Copy data from old documents
     - Delete old documents

### Option 2: Automated Migration Script (Recommended for Large Datasets)

Create a migration script using Node.js and the Firebase Admin SDK:

```javascript
// migration.js
const admin = require('firebase-admin');
const serviceAccount = require('./path-to-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateData(userId) {
  // Migrate Recipes
  const recipesSnapshot = await db.collection('recipes').get();
  const recipeBatch = db.batch();
  
  recipesSnapshot.forEach(doc => {
    const data = doc.data();
    if (!data.userId) {
      recipeBatch.update(doc.ref, { userId: userId });
    }
  });
  await recipeBatch.commit();
  console.log('Recipes migrated');

  // Migrate Meal Plans
  const mealPlansSnapshot = await db.collection('mealPlans').get();
  const mealPlanBatch = db.batch();
  
  mealPlansSnapshot.forEach(doc => {
    const data = doc.data();
    if (!data.userId) {
      const newDocId = `${userId}_${doc.id}`;
      const newRef = db.collection('mealPlans').doc(newDocId);
      mealPlanBatch.set(newRef, { ...data, userId: userId });
      mealPlanBatch.delete(doc.ref);
    }
  });
  await mealPlanBatch.commit();
  console.log('Meal plans migrated');

  // Migrate Shopping Lists
  const shoppingListsSnapshot = await db.collection('shoppingLists').get();
  const shoppingListBatch = db.batch();
  
  shoppingListsSnapshot.forEach(doc => {
    const data = doc.data();
    if (!data.userId) {
      const newDocId = `${userId}_${doc.id}`;
      const newRef = db.collection('shoppingLists').doc(newDocId);
      shoppingListBatch.set(newRef, { ...data, userId: userId });
      shoppingListBatch.delete(doc.ref);
    }
  });
  await shoppingListBatch.commit();
  console.log('Shopping lists migrated');

  // Migrate Notes
  const notesSnapshot = await db.collection('notes').get();
  const notesBatch = db.batch();
  
  notesSnapshot.forEach(doc => {
    const data = doc.data();
    if (!data.userId) {
      notesBatch.update(doc.ref, { userId: userId });
    }
  });
  await notesBatch.commit();
  console.log('Notes migrated');

  console.log('Migration complete!');
}

// Run migration
// Replace 'YOUR_USER_ID' with your actual Firebase Auth UID
migrateData('YOUR_USER_ID').catch(console.error);
```

**To run the migration script:**
1. Install Firebase Admin SDK: `npm install firebase-admin`
2. Get your service account key from Firebase Console > Project Settings > Service Accounts
3. Update the script with your user ID
4. Run: `node migration.js`

## Important Notes

1. **Backup First**: Always backup your Firestore database before running migrations
2. **Test Environment**: Test the migration on a development/staging environment first
3. **Security Rules**: Make sure to deploy the new security rules (`firestore.rules`) before users start using the app
4. **User Association**: All existing data will be associated with the user account you specify during migration

## Post-Migration Checklist

- [ ] All documents have `userId` field
- [ ] Meal plans and shopping lists use new document ID format
- [ ] Security rules are deployed
- [ ] Test login with migrated user account
- [ ] Verify data is accessible after login
- [ ] Test creating new data as authenticated user

## Rollback Plan

If something goes wrong:
1. Restore from backup
2. Revert security rules to allow unauthenticated access temporarily
3. Fix issues and retry migration

