/**
 * Setup Verification Script
 * 
 * This script verifies that your Firebase migration setup is correct
 * before running the actual migration.
 * 
 * Run: node scripts/verify-setup.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 Verifying Firebase Migration Setup...\n');
console.log('=' .repeat(50));

let allChecksPassed = true;

// Check 1: Firebase Admin SDK installed
console.log('\n✅ Check 1: Firebase Admin SDK Installation');
try {
  require.resolve('firebase-admin');
  console.log('   ✓ firebase-admin is installed');
} catch (error) {
  console.log('   ✗ firebase-admin is NOT installed');
  console.log('   → Run: npm install firebase-admin');
  allChecksPassed = false;
}

// Check 2: Service Account Key File
console.log('\n✅ Check 2: Service Account Key File');
const serviceAccountPath = '/Users/kevinbaliat/Desktop/Projects/tokens/meal-planner-4bfa6-firebase-adminsdk-fbsvc-06e6c00494.json';
const altServiceAccountPath = path.join(os.homedir(), '.firebase-credentials', 'service-account-key.json');
const projectKeyPath = path.join(__dirname, 'credentials', 'service-account-key.json');

let serviceAccountExists = false;
let serviceAccountPathToUse = null;

// Check primary location (user-specified path)
if (fs.existsSync(serviceAccountPath)) {
  serviceAccountExists = true;
  serviceAccountPathToUse = serviceAccountPath;
  console.log(`   ✓ Service account key found at: ${serviceAccountPath}`);
} else if (fs.existsSync(altServiceAccountPath)) {
  // Check secure location
  serviceAccountExists = true;
  serviceAccountPathToUse = altServiceAccountPath;
  console.log(`   ✓ Service account key found at: ${altServiceAccountPath}`);
} else if (fs.existsSync(projectKeyPath)) {
  // Check project directory (less secure)
  serviceAccountExists = true;
  serviceAccountPathToUse = projectKeyPath;
  console.log(`   ✓ Service account key found at: ${projectKeyPath}`);
  console.log('   ⚠️  Warning: Key is in project directory. Make sure it\'s in .gitignore!');
} else {
  console.log('   ✗ Service account key NOT found');
  console.log(`   → Primary location: ${serviceAccountPath}`);
  console.log(`   → Secure location: ${altServiceAccountPath}`);
  console.log(`   → Project location: ${projectKeyPath}`);
  console.log('   → Download from Firebase Console > Project Settings > Service Accounts');
  allChecksPassed = false;
}

// Check 3: Service Account Key Structure
if (serviceAccountExists) {
  console.log('\n✅ Check 3: Service Account Key Structure');
  try {
    const keyContent = fs.readFileSync(serviceAccountPathToUse, 'utf8');
    const keyData = JSON.parse(keyContent);
    
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !keyData[field]);
    
    if (missingFields.length === 0) {
      console.log('   ✓ Service account key has correct structure');
      console.log(`   ✓ Project ID: ${keyData.project_id}`);
      console.log(`   ✓ Client Email: ${keyData.client_email}`);
    } else {
      console.log('   ✗ Service account key is missing required fields:');
      missingFields.forEach(field => console.log(`      - ${field}`));
      allChecksPassed = false;
    }
  } catch (error) {
    console.log('   ✗ Error reading service account key:');
    console.log(`      ${error.message}`);
    allChecksPassed = false;
  }
}

// Check 4: File Permissions (Unix/Mac only)
if (serviceAccountExists && process.platform !== 'win32') {
  console.log('\n✅ Check 4: Service Account Key Permissions');
  try {
    const stats = fs.statSync(serviceAccountPathToUse);
    const mode = stats.mode.toString(8).slice(-3);
    
    if (mode === '600') {
      console.log('   ✓ File permissions are secure (600)');
    } else {
      console.log(`   ⚠️  File permissions are ${mode} (should be 600)`);
      console.log('   → Run: chmod 600 ' + serviceAccountPathToUse);
      // Not a blocker, but a warning
    }
  } catch (error) {
    console.log('   ⚠️  Could not check file permissions');
  }
}

// Check 5: .gitignore includes service account keys
console.log('\n✅ Check 5: .gitignore Configuration');
const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  const serviceAccountPatterns = [
    'service-account-key.json',
    '*-firebase-adminsdk-*.json',
    'credentials/',
    '.firebase-credentials'
  ];
  
  const hasProtection = serviceAccountPatterns.some(pattern => 
    gitignoreContent.includes(pattern)
  );
  
  if (hasProtection) {
    console.log('   ✓ .gitignore includes service account key patterns');
  } else {
    console.log('   ⚠️  .gitignore may not protect service account keys');
    console.log('   → Verify service account keys are in .gitignore');
  }
} else {
  console.log('   ⚠️  .gitignore file not found');
}

// Check 6: Environment Variables (optional check)
console.log('\n✅ Check 6: Environment Variables (Client-side Config)');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasProjectId = envContent.includes('REACT_APP_FIREBASE_PROJECT_ID');
  
  if (hasProjectId) {
    console.log('   ✓ .env file exists with Firebase configuration');
  } else {
    console.log('   ⚠️  .env file exists but may be missing Firebase config');
  }
} else {
  console.log('   ℹ️  .env file not found (may be using environment variables)');
}

// Summary
console.log('\n' + '='.repeat(50));
if (allChecksPassed) {
  console.log('\n✅ All critical checks passed!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Get your User ID (UID) from Firebase Console > Authentication > Users');
  console.log('   2. Inform that Step 1 setup is complete');
  console.log('   3. Wait for Step 2: Migration script with guardrails');
} else {
  console.log('\n❌ Some checks failed. Please fix the issues above before proceeding.');
  console.log('\n📖 See FIREBASE_MIGRATION_SETUP.md for detailed setup instructions.');
  process.exit(1);
}

console.log('\n');

