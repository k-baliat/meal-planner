# Step 2: Safe Data Migration Guide

This guide explains how to safely migrate your existing data to the multi-user structure with comprehensive guardrails to prevent data loss.

## Safety Features

✅ **Automatic Backups**: Creates full backup before any changes  
✅ **Dry-Run Mode**: Test migration without making changes  
✅ **Rollback Capability**: Restore from backup if something goes wrong  
✅ **Validation Checks**: Verifies data structure and user existence  
✅ **Error Recovery**: Continues processing even if individual documents fail  
✅ **Detailed Logging**: Complete log of all operations  
✅ **Progress Tracking**: Shows progress for large datasets  
✅ **Idempotent**: Safe to run multiple times (skips already-migrated data)

---

## Prerequisites

- ✅ Step 1 complete (Firebase setup done)
- ✅ User ID (UID) from Firebase Authentication
- ✅ Service account key configured
- ✅ Backup directory created automatically

---

## Step-by-Step Migration Process

### Step 1: Verify Setup

```bash
node scripts/verify-setup.js
```

Should show all checks passing.

### Step 2: Run Dry-Run (TEST FIRST!)

**IMPORTANT**: Always run dry-run first to see what will happen without making changes.

```bash
node scripts/migrate-data.js --dry-run --userId YOUR_USER_ID_HERE
```

**What it does**:
- Validates your data
- Shows what would be migrated
- **Does NOT make any changes**
- **Does NOT create backup** (since no changes are made)

**Expected Output**:
```
🚀 Data Migration Script - Step 2
============================================================

User ID: abc123def456
Mode: DRY RUN (no changes will be made)
============================================================

🔍 Validating data before migration...
  ✓ User found: your-email@example.com
  ✓ Collection 'recipes' exists
  ...

📋 Migrating Recipes Collection...
  Found 150 recipes to process.
  [DRY RUN] Would add userId to recipe: Spaghetti (recipe123)
  [DRY RUN] Would add userId to recipe: Tacos (recipe456)
  ...

⚠️  This was a DRY RUN. No changes were made.
   Run without --dry-run to perform actual migration.
```

### Step 3: Review Dry-Run Results

Check the output to ensure:
- ✅ All collections are found
- ✅ Correct number of documents will be migrated
- ✅ No unexpected errors
- ✅ User ID is correct

### Step 4: Run Actual Migration

**ONLY AFTER VERIFYING DRY-RUN RESULTS**

```bash
node scripts/migrate-data.js --userId YOUR_USER_ID_HERE
```

**What it does**:
1. ✅ Validates data
2. ✅ Creates automatic backup
3. ✅ Migrates recipes (adds userId)
4. ✅ Migrates meal plans (creates new docs with userId prefix, deletes old)
5. ✅ Migrates shopping lists (creates new docs with userId prefix, deletes old)
6. ✅ Migrates notes (adds userId)
7. ✅ Verifies migration results
8. ✅ Shows summary and backup ID

**Expected Output**:
```
🚀 Data Migration Script - Step 2
============================================================

User ID: abc123def456
Mode: LIVE MIGRATION
============================================================

🔍 Validating data before migration...
  ✓ User found: your-email@example.com
  ...

📦 Creating backup...
Backup ID: backup_2025-03-23_1234567890
  Backing up recipes...
    ✓ Backed up 150 documents from recipes
  ...

✅ Backup saved to: scripts/backups/backup_2025-03-23_1234567890.json

📋 Migrating Recipes Collection...
  Found 150 recipes to process.
  Progress: 100/150 recipes...
  ✅ Recipes migration complete:
     Processed: 150
     Updated: 142
     Skipped: 8
     Errors: 0

📅 Migrating Meal Plans Collection...
  ...

✅ Migration completed successfully!

💾 Backup ID: backup_2025-03-23_1234567890
   Backup location: scripts/backups/backup_2025-03-23_1234567890.json
   To rollback: node scripts/migrate-data.js --rollback --backup-id backup_2025-03-23_1234567890
```

### Step 5: Verify Migration

After migration completes:

1. **Check Firebase Console**:
   - Go to Firestore Database
   - Verify recipes have `userId` field
   - Verify meal plans use new document ID format: `{userId}_{weekRange}`
   - Verify shopping lists use new document ID format: `{userId}_{weekRange}`
   - Verify notes have `userId` field

2. **Test in App**:
   - Sign in with your migrated user account
   - Verify you can see all your recipes
   - Verify meal plans load correctly
   - Verify shopping lists work
   - Verify notes are accessible

---

## Rollback (If Something Goes Wrong)

If you need to restore from backup:

```bash
node scripts/migrate-data.js --rollback --backup-id BACKUP_ID_HERE
```

**Example**:
```bash
node scripts/migrate-data.js --rollback --backup-id backup_2025-03-23_1234567890
```

**What it does**:
- Restores all collections from backup
- Overwrites current data with backup data
- **Use with caution** - this will overwrite any changes made after backup

**To find backup ID**:
```bash
ls scripts/backups/
```

---

## What Gets Migrated

### Recipes Collection
- **Action**: Adds `userId` field to each recipe
- **Document ID**: Unchanged
- **Safety**: Skips recipes that already have `userId`

### Meal Plans Collection
- **Action**: 
  - Creates new documents with ID: `{userId}_{weekRange}`
  - Adds `userId` field
  - Deletes old documents
- **Safety**: 
  - Skips if new document already exists
  - Skips if already has `userId`

### Shopping Lists Collection
- **Action**:
  - Creates new documents with ID: `{userId}_{weekRange}`
  - Adds `userId` field
  - Deletes old documents
- **Safety**:
  - Skips if new document already exists
  - Skips if already has `userId`

### Notes Collection
- **Action**: Adds `userId` field to each note
- **Document ID**: Unchanged
- **Safety**: Skips notes that already have `userId`

---

## Safety Guarantees

### ✅ No Data Loss
- **Automatic backup** before any changes
- **Backup stored locally** in `scripts/backups/`
- **Rollback capability** to restore from backup
- **Validation checks** before migration
- **Error recovery** - continues even if individual documents fail

### ✅ Safe to Run Multiple Times
- **Idempotent**: Skips already-migrated data
- **Checks for existing userId**: Won't duplicate
- **Checks for existing documents**: Won't overwrite

### ✅ Detailed Logging
- **Progress updates** every 100 documents
- **Error messages** for failed documents
- **Summary statistics** at the end
- **Backup ID** saved for rollback

---

## Troubleshooting

### Error: "User ID not found in Firebase Auth"
**Solution**: Verify your user ID is correct. Get it from Firebase Console > Authentication > Users

### Error: "Collection does not exist"
**Solution**: Check that your Firestore database has the collections: recipes, mealPlans, shoppingLists, notes

### Error: "Permission denied"
**Solution**: 
- Verify service account key has correct permissions
- Check that key file is readable: `chmod 600 path/to/key.json`

### Migration completes but data not visible in app
**Possible causes**:
- Security rules not deployed
- User ID mismatch
- App cache - try refreshing

**Solution**:
1. Deploy security rules: `firebase deploy --only firestore:rules`
2. Verify user ID matches
3. Clear browser cache and refresh

### Need to rollback
**Solution**: Use the backup ID from migration output:
```bash
node scripts/migrate-data.js --rollback --backup-id YOUR_BACKUP_ID
```

---

## Migration Checklist

Before Migration:
- [ ] Step 1 setup complete
- [ ] User ID (UID) copied
- [ ] Service account key configured
- [ ] Verified setup: `node scripts/verify-setup.js`

During Migration:
- [ ] Run dry-run first: `--dry-run --userId YOUR_UID`
- [ ] Review dry-run results
- [ ] Run actual migration: `--userId YOUR_UID`
- [ ] Save backup ID from output

After Migration:
- [ ] Verify in Firebase Console
- [ ] Test in app (sign in, check data)
- [ ] Verify security rules deployed
- [ ] Test creating new data

---

## Example Commands

```bash
# 1. Verify setup
node scripts/verify-setup.js

# 2. Dry-run (test)
node scripts/migrate-data.js --dry-run --userId abc123def456ghi789

# 3. Actual migration
node scripts/migrate-data.js --userId abc123def456ghi789

# 4. Rollback (if needed)
node scripts/migrate-data.js --rollback --backup-id backup_2025-03-23_1234567890

# 5. List backups
ls scripts/backups/
```

---

## Important Notes

1. **Backups are stored locally** in `scripts/backups/` directory
2. **Keep backups safe** - they contain all your data
3. **Backup before each migration** - script does this automatically
4. **Test with dry-run first** - always verify before making changes
5. **Migration is idempotent** - safe to run multiple times
6. **Old documents are deleted** - meal plans and shopping lists get new IDs

---

## Support

If you encounter issues:
1. Check the error message
2. Review the troubleshooting section
3. Check Firebase Console for data state
4. Use rollback if needed
5. Review backup files in `scripts/backups/`

---

**Ready to migrate?** Start with the dry-run to see what will happen!

