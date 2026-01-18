/**
 * Fix Wrong UserId Script
 * 
 * This script fixes recipes that were migrated with the wrong userId.
 * It updates recipes from the incorrect userId to the correct one.
 * 
 * SAFETY FEATURES:
 * - Automatic backup before making changes
 * - Dry-run mode to test without making changes
 * - Detailed logging
 * - Validation checks
 * 
 * Usage:
 *   Dry-run (test): node scripts/fix-wrong-userid.js --dry-run --wrongUserId WRONG_UID --correctUserId CORRECT_UID
 *   Actual fix:     node scripts/fix-wrong-userid.js --wrongUserId WRONG_UID --correctUserId CORRECT_UID
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const wrongUserIdIndex = args.indexOf('--wrongUserId');
const wrongUserId = wrongUserIdIndex !== -1 ? args[wrongUserIdIndex + 1] : null;
const correctUserIdIndex = args.indexOf('--correctUserId');
const correctUserId = correctUserIdIndex !== -1 ? args[correctUserIdIndex + 1] : null;

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
 * Create a backup of recipes with wrong userId
 */
async function createBackup(backupId) {
  console.log('\n📦 Creating backup of recipes with wrong userId...');
  console.log(`Backup ID: ${backupId}`);
  
  const backupData = {
    backupId: backupId,
    timestamp: new Date().toISOString(),
    wrongUserId: wrongUserId,
    correctUserId: correctUserId,
    collections: {
      recipes: {}
    }
  };
  
  // Get recipes with wrong userId
  const recipesRef = db.collection('recipes');
  const snapshot = await recipesRef.where('userId', '==', wrongUserId).get();
  
  console.log(`  Found ${snapshot.size} recipes with wrong userId (${wrongUserId})`);
  
  snapshot.docs.forEach(doc => {
    backupData.collections.recipes[doc.id] = doc.data();
  });
  
  // Save backup to file
  const backupPath = path.join(BACKUP_DIR, `${backupId}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  
  console.log(`  ✅ Backup saved to: ${backupPath}`);
  
  return backupData;
}

/**
 * Fix recipes with wrong userId
 */
async function fixRecipes(isDryRun) {
  console.log('\n🔧 Fixing Recipes with Wrong UserId...');
  console.log(`  Wrong UserId: ${wrongUserId}`);
  console.log(`  Correct UserId: ${correctUserId}`);
  
  const recipesRef = db.collection('recipes');
  const snapshot = await recipesRef.where('userId', '==', wrongUserId).get();
  
  if (snapshot.empty) {
    console.log('  ℹ️  No recipes found with wrong userId.');
    return { processed: 0, updated: 0, errors: 0 };
  }
  
  console.log(`  Found ${snapshot.size} recipes to fix.`);
  
  let processed = 0;
  let updated = 0;
  let errors = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const doc of snapshot.docs) {
    try {
      const recipe = doc.data();
      
      // Verify it has the wrong userId
      if (recipe.userId !== wrongUserId) {
        console.log(`  ⚠️  Skipping recipe ${doc.id}: userId is ${recipe.userId}, not ${wrongUserId}`);
        processed++;
        continue;
      }
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Would update recipe: ${recipe.name} (${doc.id})`);
        console.log(`            From userId: ${wrongUserId} → To userId: ${correctUserId}`);
        updated++;
      } else {
        batch.update(doc.ref, { userId: correctUserId });
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
  
  console.log(`\n  ✅ Recipes fix complete:`);
  console.log(`     Processed: ${processed}`);
  console.log(`     Updated: ${updated}`);
  console.log(`     Errors: ${errors}`);
  
  return { processed, updated, errors };
}

/**
 * Verify the fix
 */
async function verifyFix() {
  console.log('\n🔍 Verifying fix...');
  
  const issues = [];
  
  // Check recipes with wrong userId (should be 0)
  const wrongRecipes = await db.collection('recipes').where('userId', '==', wrongUserId).get();
  if (wrongRecipes.size > 0) {
    issues.push(`Found ${wrongRecipes.size} recipes still with wrong userId (${wrongUserId})`);
  } else {
    console.log(`  ✓ No recipes found with wrong userId (${wrongUserId})`);
  }
  
  // Check recipes with correct userId
  const correctRecipes = await db.collection('recipes').where('userId', '==', correctUserId).get();
  console.log(`  ✓ Found ${correctRecipes.size} recipes with correct userId (${correctUserId})`);
  
  if (issues.length > 0) {
    console.log('\n⚠️  Verification warnings:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('\n  ✅ Verification passed!');
  }
  
  return issues;
}

/**
 * Main function
 */
async function runFix() {
  // Validate arguments
  if (!wrongUserId || !correctUserId) {
    console.error('❌ Error: Both --wrongUserId and --correctUserId are required');
    console.log('\nUsage:');
    console.log('  Dry-run:  node scripts/fix-wrong-userid.js --dry-run --wrongUserId WRONG_UID --correctUserId CORRECT_UID');
    console.log('  Fix:      node scripts/fix-wrong-userid.js --wrongUserId WRONG_UID --correctUserId CORRECT_UID');
    process.exit(1);
  }
  
  if (wrongUserId === correctUserId) {
    console.error('❌ Error: wrongUserId and correctUserId cannot be the same');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔧 FIX WRONG USERID SCRIPT');
  console.log('='.repeat(60));
  console.log(`Wrong UserId: ${wrongUserId}`);
  console.log(`Correct UserId: ${correctUserId}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE FIX'}`);
  console.log('='.repeat(60));
  
  try {
    // Step 1: Create backup (unless dry-run)
    let backupData = null;
    let backupId = null;
    
    if (!isDryRun) {
      backupId = generateBackupId();
      backupData = await createBackup(backupId);
      console.log(`\n💾 Backup created. Backup ID: ${backupId}`);
    } else {
      console.log('\n⚠️  DRY RUN MODE: No backup created (no changes will be made)');
    }
    
    // Step 2: Fix recipes
    const results = await fixRecipes(isDryRun);
    
    // Step 3: Verify fix (only if not dry-run)
    if (!isDryRun) {
      await verifyFix();
    }
    
    // Step 4: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total recipes processed: ${results.processed}`);
    console.log(`Total recipes updated: ${results.updated}`);
    console.log(`Total errors: ${results.errors}`);
    
    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to perform actual fix.');
    } else {
      console.log('\n✅ Fix completed successfully!');
      if (backupId) {
        console.log(`\n💾 Backup ID: ${backupId}`);
        console.log(`   Backup location: ${path.join(BACKUP_DIR, `${backupId}.json`)}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run fix
runFix()
  .then(() => {
    console.log('\n✅ Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });





