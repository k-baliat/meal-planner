# Fix Wrong UserId Guide

## Problem

You accidentally ran the migration script with the wrong User ID. Some recipes now have the incorrect `userId` field.

## Solution

You have two options:

### Option 1: Fix the Wrong UserId (Recommended)

Use the `fix-wrong-userid.js` script to update recipes from the wrong userId to the correct one.

**Steps:**

1. **First, do a dry-run to see what will be fixed:**
   ```bash
   node scripts/fix-wrong-userid.js --dry-run --wrongUserId WRONG_UID --correctUserId CORRECT_UID
   ```

2. **If the dry-run looks good, run the actual fix:**
   ```bash
   node scripts/fix-wrong-userid.js --wrongUserId WRONG_UID --correctUserId CORRECT_UID
   ```

**Example:**
```bash
# Dry-run first
node scripts/fix-wrong-userid.js --dry-run --wrongUserId abc123 --correctUserId xyz789

# If looks good, run actual fix
node scripts/fix-wrong-userid.js --wrongUserId abc123 --correctUserId xyz789
```

**What it does:**
- Creates a backup of recipes with the wrong userId
- Updates all recipes from wrongUserId to correctUserId
- Verifies the fix was successful
- Provides detailed logging

### Option 2: Rollback and Re-run Migration

If you prefer to start fresh:

1. **Find the backup ID from when you ran the migration:**
   - Check the console output from your previous migration
   - Or look in `scripts/backups/` directory for the backup file

2. **Rollback to the backup:**
   ```bash
   node scripts/migrate-data.js --rollback --backup-id BACKUP_ID
   ```

3. **Re-run migration with correct User ID:**
   ```bash
   node scripts/migrate-data.js --userId CORRECT_UID
   ```

## Finding Your User IDs

To find the correct User ID:

1. **From Firebase Console:**
   - Go to Firebase Console > Authentication > Users
   - Find your user and copy the UID

2. **From the app:**
   - Open browser console (F12)
   - Run: `firebase.auth().currentUser.uid`
   - Or check the user dropdown in the app banner

## Safety Features

Both scripts include:
- ✅ Automatic backups before making changes
- ✅ Dry-run mode to test without changes
- ✅ Detailed logging of all operations
- ✅ Validation checks
- ✅ Error handling

## Important Notes

1. **The migration script skips recipes that already have a userId**
   - This is why running migration again won't fix recipes with wrong userId
   - You need to use the fix script to update them

2. **Always do a dry-run first**
   - This shows you exactly what will be changed
   - No changes are made in dry-run mode

3. **Backups are created automatically**
   - You can rollback if something goes wrong
   - Backup location: `scripts/backups/`

## Verification

After running the fix, verify it worked:

1. Check the console output for verification results
2. In Firebase Console, check that recipes have the correct userId
3. In your app, verify recipes appear in "My Recipes" tab

## Need Help?

If you encounter issues:
1. Check the console output for error messages
2. Verify both User IDs are correct
3. Make sure you have the correct Firebase service account key
4. Check that you have write permissions in Firestore

