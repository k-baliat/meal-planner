/**
 * Data Migration Script - Step 2: Safe Migration with Guardrails
 * 
 * This script migrates existing single-user data to multi-user structure.
 * 
 * SAFETY FEATURES:
 * - Automatic backups before any changes
 * - Dry-run mode to test without making changes
 * - Detailed logging of all operations
 * - Rollback capability
 * - Validation checks
 * - Error recovery
 * - Progress tracking
 * 
 * Usage:
 *   Dry-run (test): node scripts/migrate-data.js --dry-run --userId YOUR_UID
 *   Actual run:     node scripts/migrate-data.js --userId YOUR_UID
 *   Rollback:       node scripts/migrate-data.js --rollback --backup-id BACKUP_ID
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isRollback = args.includes('--rollback');
const userIdIndex = args.indexOf('--userId');
const userId = userIdIndex !== -1 ? args[userIdIndex + 1] : null;
const backupIdIndex = args.indexOf('--backup-id');
const backupId = backupIdIndex !== -1 ? args[backupIdIndex + 1] : null;

// Service Account Key Configuration
const serviceAccountPath = '/Users/kevinbaliat/Desktop/Projects/tokens/meal-planner-4bfa6-firebase-adminsdk-fbsvc-06e6c00494.json';
const altServiceAccountPath1 = path.join(os.homedir(), '.firebase-credentials', 'service-account-key.json');
const altServiceAccountPath2 = path.join(__dirname, 'credentials', 'service-account-key.json');

let serviceAccountPathToUse = null;
if (fs.existsSync(serviceAccountPath)) {
  serviceAccountPathToUse = serviceAccountPath;
} else if (fs.existsSync(altServiceAccountPath1)) {
  serviceAccountPathToUse = altServiceAccountPath1;
} else if (fs.existsSync(altServiceAccountPath2)) {
  serviceAccountPathToUse = altServiceAccountPath2;
} else {
  throw new Error(`Service account key not found. Checked:\n  ${serviceAccountPath}\n  ${altServiceAccountPath1}\n  ${altServiceAccountPath2}`);
}

const serviceAccount = require(serviceAccountPathToUse);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Backup directory
const BACKUP_DIR = path.join(__dirname, 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create a timestamped backup ID
 */
function generateBackupId() {
  const now = new Date();
  return `backup_${now.toISOString().replace(/[:.]/g, '-').split('T')[0]}_${now.getTime()}`;
}

/**
 * Create a backup of all collections before migration
 */
async function createBackup(backupId) {
  console.log('\n📦 Creating backup...');
  console.log(`Backup ID: ${backupId}`);
  
  const backupData = {
    backupId: backupId,
    timestamp: new Date().toISOString(),
    userId: userId,
    collections: {}
  };
  
  const collections = ['recipes', 'mealPlans', 'shoppingLists', 'notes'];
  
  for (const collectionName of collections) {
    console.log(`  Backing up ${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    backupData.collections[collectionName] = {};
    
    snapshot.docs.forEach(doc => {
      backupData.collections[collectionName][doc.id] = doc.data();
    });
    
    console.log(`    ✓ Backed up ${snapshot.size} documents from ${collectionName}`);
  }
  
  // Save backup to file
  const backupFilePath = path.join(BACKUP_DIR, `${backupId}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
  console.log(`\n✅ Backup saved to: ${backupFilePath}`);
  
  return backupData;
}

/**
 * Restore from backup
 */
async function restoreFromBackup(backupId) {
  console.log(`\n🔄 Restoring from backup: ${backupId}`);
  
  const backupFilePath = path.join(BACKUP_DIR, `${backupId}.json`);
  
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }
  
  const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  
  console.log(`Backup timestamp: ${backupData.timestamp}`);
  console.log(`Backup user ID: ${backupData.userId}`);
  
  // Restore each collection
  for (const [collectionName, documents] of Object.entries(backupData.collections)) {
    console.log(`\n  Restoring ${collectionName}...`);
    
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    
    for (const [docId, docData] of Object.entries(documents)) {
      const docRef = db.collection(collectionName).doc(docId);
      batch.set(docRef, docData);
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`    Restored ${batchCount} documents...`);
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`    ✓ Restored ${Object.keys(documents).length} documents from ${collectionName}`);
  }
  
  console.log('\n✅ Restore complete!');
}

/**
 * Validate data before migration
 */
async function validateData() {
  console.log('\n🔍 Validating data before migration...');
  
  const issues = [];
  
  // Check if userId is provided
  if (!userId) {
    issues.push('User ID (--userId) is required');
  }
  
  // Check if user exists in Firebase Auth
  try {
    const user = await admin.auth().getUser(userId);
    console.log(`  ✓ User found: ${user.email}`);
  } catch (error) {
    issues.push(`User ID ${userId} not found in Firebase Auth: ${error.message}`);
  }
  
  // Check collections exist
  const collections = ['recipes', 'mealPlans', 'shoppingLists', 'notes'];
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).limit(1).get();
      console.log(`  ✓ Collection '${collectionName}' exists`);
    } catch (error) {
      issues.push(`Collection '${collectionName}' error: ${error.message}`);
    }
  }
  
  if (issues.length > 0) {
    console.log('\n❌ Validation failed:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    throw new Error('Data validation failed');
  }
  
  console.log('✅ All validations passed!');
}

/**
 * Migrate Recipes Collection
 */
async function migrateRecipes(backupData, isDryRun) {
  console.log('\n📋 Migrating Recipes Collection...');
  
  const recipesRef = db.collection('recipes');
  const snapshot = await recipesRef.get();
  
  if (snapshot.empty) {
    console.log('  ℹ️  No recipes found to migrate.');
    return { processed: 0, updated: 0, skipped: 0, errors: 0 };
  }
  
  console.log(`  Found ${snapshot.size} recipes to process.`);
  
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const doc of snapshot.docs) {
    try {
      const recipe = doc.data();
      
      // Skip if already has userId
      if (recipe.userId) {
        skipped++;
        processed++;
        continue;
      }
      
      // Validate recipe structure
      if (!recipe.name || !recipe.ingredients || !Array.isArray(recipe.ingredients)) {
        console.log(`  ⚠️  Skipping recipe ${doc.id}: Invalid structure`);
        errors++;
        processed++;
        continue;
      }
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Would add userId to recipe: ${recipe.name} (${doc.id})`);
        updated++;
      } else {
        batch.update(doc.ref, { userId: userId });
        batchCount++;
        updated++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  Processed ${processed} recipes, updated ${updated}...`);
          batchCount = 0;
        }
      }
      
      processed++;
      
      if (processed % 100 === 0 && !isDryRun) {
        console.log(`  Progress: ${processed}/${snapshot.size} recipes...`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing recipe ${doc.id}:`, error.message);
      errors++;
      processed++;
    }
  }
  
  // Commit remaining updates
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`\n  ✅ Recipes migration complete:`);
  console.log(`     Processed: ${processed}`);
  console.log(`     Updated: ${updated}`);
  console.log(`     Skipped: ${skipped}`);
  console.log(`     Errors: ${errors}`);
  
  return { processed, updated, skipped, errors };
}

/**
 * Migrate Meal Plans Collection
 */
async function migrateMealPlans(backupData, isDryRun) {
  console.log('\n📅 Migrating Meal Plans Collection...');
  
  const mealPlansRef = db.collection('mealPlans');
  const snapshot = await mealPlansRef.get();
  
  if (snapshot.empty) {
    console.log('  ℹ️  No meal plans found to migrate.');
    return { processed: 0, created: 0, deleted: 0, errors: 0 };
  }
  
  console.log(`  Found ${snapshot.size} meal plans to process.`);
  
  let processed = 0;
  let created = 0;
  let deleted = 0;
  let errors = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const doc of snapshot.docs) {
    try {
      const mealPlan = doc.data();
      
      // Skip if already has userId (already migrated)
      if (mealPlan.userId) {
        processed++;
        continue;
      }
      
      // Skip if document ID already contains userId (new format)
      if (doc.id.includes('_') && doc.id.startsWith(userId + '_')) {
        processed++;
        continue;
      }
      
      // Create new document with userId prefix
      const newDocId = `${userId}_${doc.id}`;
      const newRef = mealPlansRef.doc(newDocId);
      
      // Check if new document already exists
      const newDoc = await newRef.get();
      if (newDoc.exists()) {
        console.log(`  ⚠️  New document ${newDocId} already exists, skipping`);
        processed++;
        continue;
      }
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate meal plan: ${doc.id} → ${newDocId}`);
        created++;
        deleted++;
      } else {
        // Create new document with userId
        batch.set(newRef, {
          ...mealPlan,
          userId: userId
        });
        batchCount++;
        
        // Delete old document
        batch.delete(doc.ref);
        batchCount++;
        
        created++;
        deleted++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  Processed ${processed} meal plans...`);
          batchCount = 0;
        }
      }
      
      processed++;
      
      if (processed % 50 === 0 && !isDryRun) {
        console.log(`  Progress: ${processed}/${snapshot.size} meal plans...`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing meal plan ${doc.id}:`, error.message);
      errors++;
      processed++;
    }
  }
  
  // Commit remaining updates
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`\n  ✅ Meal plans migration complete:`);
  console.log(`     Processed: ${processed}`);
  console.log(`     Created: ${created}`);
  console.log(`     Deleted: ${deleted}`);
  console.log(`     Errors: ${errors}`);
  
  return { processed, created, deleted, errors };
}

/**
 * Migrate Shopping Lists Collection
 */
async function migrateShoppingLists(backupData, isDryRun) {
  console.log('\n🛒 Migrating Shopping Lists Collection...');
  
  const shoppingListsRef = db.collection('shoppingLists');
  const snapshot = await shoppingListsRef.get();
  
  if (snapshot.empty) {
    console.log('  ℹ️  No shopping lists found to migrate.');
    return { processed: 0, created: 0, deleted: 0, errors: 0 };
  }
  
  console.log(`  Found ${snapshot.size} shopping lists to process.`);
  
  let processed = 0;
  let created = 0;
  let deleted = 0;
  let errors = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const doc of snapshot.docs) {
    try {
      const shoppingList = doc.data();
      
      // Skip if already has userId
      if (shoppingList.userId) {
        processed++;
        continue;
      }
      
      // Skip if document ID already contains userId
      if (doc.id.includes('_') && doc.id.startsWith(userId + '_')) {
        processed++;
        continue;
      }
      
      // Create new document with userId prefix
      const newDocId = `${userId}_${doc.id}`;
      const newRef = shoppingListsRef.doc(newDocId);
      
      // Check if new document already exists
      const newDoc = await newRef.get();
      if (newDoc.exists()) {
        console.log(`  ⚠️  New document ${newDocId} already exists, skipping`);
        processed++;
        continue;
      }
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate shopping list: ${doc.id} → ${newDocId}`);
        created++;
        deleted++;
      } else {
        // Create new document with userId
        batch.set(newRef, {
          ...shoppingList,
          userId: userId
        });
        batchCount++;
        
        // Delete old document
        batch.delete(doc.ref);
        batchCount++;
        
        created++;
        deleted++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  Processed ${processed} shopping lists...`);
          batchCount = 0;
        }
      }
      
      processed++;
      
      if (processed % 50 === 0 && !isDryRun) {
        console.log(`  Progress: ${processed}/${snapshot.size} shopping lists...`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing shopping list ${doc.id}:`, error.message);
      errors++;
      processed++;
    }
  }
  
  // Commit remaining updates
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`\n  ✅ Shopping lists migration complete:`);
  console.log(`     Processed: ${processed}`);
  console.log(`     Created: ${created}`);
  console.log(`     Deleted: ${deleted}`);
  console.log(`     Errors: ${errors}`);
  
  return { processed, created, deleted, errors };
}

/**
 * Migrate Notes Collection
 */
async function migrateNotes(backupData, isDryRun) {
  console.log('\n📝 Migrating Notes Collection...');
  
  const notesRef = db.collection('notes');
  const snapshot = await notesRef.get();
  
  if (snapshot.empty) {
    console.log('  ℹ️  No notes found to migrate.');
    return { processed: 0, updated: 0, skipped: 0, errors: 0 };
  }
  
  console.log(`  Found ${snapshot.size} notes to process.`);
  
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const doc of snapshot.docs) {
    try {
      const note = doc.data();
      
      // Skip if already has userId
      if (note.userId) {
        skipped++;
        processed++;
        continue;
      }
      
      // Validate note structure
      if (!note.date || !note.content) {
        console.log(`  ⚠️  Skipping note ${doc.id}: Invalid structure`);
        errors++;
        processed++;
        continue;
      }
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Would add userId to note: ${note.date} (${doc.id})`);
        updated++;
      } else {
        batch.update(doc.ref, { userId: userId });
        batchCount++;
        updated++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  Processed ${processed} notes, updated ${updated}...`);
          batchCount = 0;
        }
      }
      
      processed++;
      
      if (processed % 100 === 0 && !isDryRun) {
        console.log(`  Progress: ${processed}/${snapshot.size} notes...`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing note ${doc.id}:`, error.message);
      errors++;
      processed++;
    }
  }
  
  // Commit remaining updates
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`\n  ✅ Notes migration complete:`);
  console.log(`     Processed: ${processed}`);
  console.log(`     Updated: ${updated}`);
  console.log(`     Skipped: ${skipped}`);
  console.log(`     Errors: ${errors}`);
  
  return { processed, updated, skipped, errors };
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  console.log('\n🔍 Verifying migration results...');
  
  const issues = [];
  
  // Check recipes
  const recipesSnapshot = await db.collection('recipes').where('userId', '==', userId).get();
  const recipesWithoutUserId = await db.collection('recipes').where('userId', '==', null).limit(1).get();
  
  if (recipesWithoutUserId.size > 0) {
    issues.push(`Found recipes without userId`);
  } else {
    console.log(`  ✓ All recipes have userId`);
  }
  
  // Check meal plans
  const mealPlansSnapshot = await db.collection('mealPlans').where('userId', '==', userId).get();
  console.log(`  ✓ Found ${mealPlansSnapshot.size} meal plans with userId`);
  
  // Check shopping lists
  const shoppingListsSnapshot = await db.collection('shoppingLists').where('userId', '==', userId).get();
  console.log(`  ✓ Found ${shoppingListsSnapshot.size} shopping lists with userId`);
  
  // Check notes
  const notesSnapshot = await db.collection('notes').where('userId', '==', userId).get();
  const notesWithoutUserId = await db.collection('notes').where('userId', '==', null).limit(1).get();
  
  if (notesWithoutUserId.size > 0) {
    issues.push(`Found notes without userId`);
  } else {
    console.log(`  ✓ All notes have userId`);
  }
  
  if (issues.length > 0) {
    console.log('\n⚠️  Verification warnings:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('\n✅ Migration verification passed!');
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Data Migration Script - Step 2');
  console.log('=' .repeat(60));
  
  if (isRollback) {
    if (!backupId) {
      console.error('❌ Error: --backup-id is required for rollback');
      console.log('\nAvailable backups:');
      const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      backups.forEach(backup => console.log(`  - ${backup.replace('.json', '')}`));
      process.exit(1);
    }
    
    await restoreFromBackup(backupId);
    return;
  }
  
  if (!userId) {
    console.error('❌ Error: --userId is required');
    console.log('\nUsage:');
    console.log('  Dry-run:  node scripts/migrate-data.js --dry-run --userId YOUR_UID');
    console.log('  Migrate:  node scripts/migrate-data.js --userId YOUR_UID');
    console.log('  Rollback: node scripts/migrate-data.js --rollback --backup-id BACKUP_ID');
    process.exit(1);
  }
  
  console.log(`\nUser ID: ${userId}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Validate data
    await validateData();
    
    // Step 2: Create backup (unless dry-run)
    let backupData = null;
    let backupId = null;
    
    if (!isDryRun) {
      backupId = generateBackupId();
      backupData = await createBackup(backupId);
      console.log(`\n💾 Backup created. Backup ID: ${backupId}`);
      console.log(`   To rollback: node scripts/migrate-data.js --rollback --backup-id ${backupId}`);
    } else {
      console.log('\n⚠️  DRY RUN MODE: No backup created (no changes will be made)');
    }
    
    // Step 3: Migrate each collection
    const results = {
      recipes: await migrateRecipes(backupData, isDryRun),
      mealPlans: await migrateMealPlans(backupData, isDryRun),
      shoppingLists: await migrateShoppingLists(backupData, isDryRun),
      notes: await migrateNotes(backupData, isDryRun)
    };
    
    // Step 4: Verify migration (only if not dry-run)
    if (!isDryRun) {
      await verifyMigration();
    }
    
    // Step 5: Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('=' .repeat(60));
    
    const totalProcessed = Object.values(results).reduce((sum, r) => sum + r.processed, 0);
    const totalUpdated = Object.values(results).reduce((sum, r) => sum + (r.updated || r.created || 0), 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);
    
    console.log(`Total documents processed: ${totalProcessed}`);
    console.log(`Total documents updated/created: ${totalUpdated}`);
    console.log(`Total errors: ${totalErrors}`);
    
    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to perform actual migration.');
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log(`\n💾 Backup ID: ${backupId}`);
      console.log(`   Backup location: ${path.join(BACKUP_DIR, `${backupId}.json`)}`);
      console.log(`   To rollback: node scripts/migrate-data.js --rollback --backup-id ${backupId}`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nStack trace:', error.stack);
    
    if (!isDryRun && backupId) {
      console.log(`\n💾 Backup available: ${backupId}`);
      console.log(`   To rollback: node scripts/migrate-data.js --rollback --backup-id ${backupId}`);
    }
    
    process.exit(1);
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });





