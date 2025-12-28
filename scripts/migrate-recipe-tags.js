/**
 * Recipe Tagging Migration Script
 * 
 * This script automatically tags all existing recipes in the database
 * based on their ingredients, cuisine, and name.
 * 
 * Usage:
 * 1. Install dependencies: npm install firebase-admin
 * 2. Get your service account key from Firebase Console
 * 3. Update the serviceAccount path and userId below
 * 4. Run: node scripts/migrate-recipe-tags.js
 */

const admin = require('firebase-admin');
const path = require('path');
const os = require('os');

// Service Account Key Configuration
// Primary location: User-specified path
const primaryKeyPath = '/Users/kevinbaliat/Desktop/Projects/tokens/meal-planner-4bfa6-firebase-adminsdk-fbsvc-06e6c00494.json';

// Fallback locations
const secureKeyPath = path.join(os.homedir(), '.firebase-credentials', 'service-account-key.json');
const projectKeyPath = path.join(__dirname, 'credentials', 'service-account-key.json');

// Try primary location first, then fallbacks
let serviceAccountPath = primaryKeyPath;
const fs = require('fs');

if (!fs.existsSync(serviceAccountPath)) {
  if (fs.existsSync(secureKeyPath)) {
    serviceAccountPath = secureKeyPath;
  } else if (fs.existsSync(projectKeyPath)) {
    serviceAccountPath = projectKeyPath;
    console.warn('⚠️  Using service account key from project directory. Consider moving to secure location.');
  } else {
    throw new Error(`Service account key not found at:\n  ${primaryKeyPath}\n  ${secureKeyPath}\n  ${projectKeyPath}\n\nPlease download from Firebase Console > Project Settings > Service Accounts`);
  }
}

const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Generate tags for a recipe based on its data
 * This matches the logic in the frontend generateRecipeTags function
 */
function generateRecipeTags(recipe) {
  const tags = [];
  const ingredients = recipe.ingredients.map(ing => ing.toLowerCase());
  const allIngredients = ingredients.join(' ');
  const recipeName = (recipe.name || '').toLowerCase();
  
  // Dietary tags based on ingredients
  if (ingredients.some(ing => 
    ing.includes('chicken') || ing.includes('turkey') || 
    ing.includes('beef') || ing.includes('pork') || 
    ing.includes('fish') || ing.includes('seafood')
  )) {
    tags.push('protein');
  }
  
  if (ingredients.some(ing => 
    ing.includes('vegetable') || ing.includes('broccoli') || 
    ing.includes('carrot') || ing.includes('spinach') || 
    ing.includes('lettuce') || ing.includes('tomato')
  )) {
    tags.push('vegetables');
  }
  
  if (ingredients.some(ing => 
    ing.includes('pasta') || ing.includes('noodle') || 
    ing.includes('rice') || ing.includes('bread')
  )) {
    tags.push('carbs');
  }
  
  if (ingredients.some(ing => 
    ing.includes('cheese') || ing.includes('milk') || 
    ing.includes('cream') || ing.includes('butter')
  )) {
    tags.push('dairy');
  }
  
  if (ingredients.some(ing => 
    ing.includes('spicy') || ing.includes('chili') || 
    ing.includes('pepper') || ing.includes('curry')
  )) {
    tags.push('spicy');
  }
  
  if (ingredients.some(ing => 
    ing.includes('sweet') || ing.includes('sugar') || 
    ing.includes('honey') || ing.includes('chocolate')
  )) {
    tags.push('sweet');
  }
  
  // Cooking method tags
  if (allIngredients.includes('grill') || allIngredients.includes('grilled')) {
    tags.push('grilled');
  }
  if (allIngredients.includes('bake') || allIngredients.includes('baked') || allIngredients.includes('oven')) {
    tags.push('baked');
  }
  if (allIngredients.includes('fry') || allIngredients.includes('fried') || allIngredients.includes('pan')) {
    tags.push('fried');
  }
  if (allIngredients.includes('slow') || allIngredients.includes('crock') || allIngredients.includes('braise')) {
    tags.push('slow-cooked');
  }
  
  // Meal type tags
  if (recipeName.includes('breakfast') || recipeName.includes('pancake') || 
      recipeName.includes('waffle') || recipeName.includes('egg')) {
    tags.push('breakfast');
  }
  if (recipeName.includes('dessert') || recipeName.includes('cake') || 
      recipeName.includes('cookie') || recipeName.includes('pie')) {
    tags.push('dessert');
  }
  if (recipeName.includes('salad')) {
    tags.push('salad');
  }
  if (recipeName.includes('soup') || recipeName.includes('stew')) {
    tags.push('soup');
  }
  
  // Cuisine-specific tags
  if (recipe.cuisine === 'Italian') {
    tags.push('italian');
  } else if (recipe.cuisine === 'Mexican') {
    tags.push('mexican');
  } else if (recipe.cuisine === 'Asian') {
    tags.push('asian');
  }
  
  // Quick/Easy tags
  const ingredientCount = recipe.ingredients ? recipe.ingredients.length : 0;
  if (ingredientCount <= 5) {
    tags.push('simple');
  }
  if (ingredientCount <= 3) {
    tags.push('quick');
  }
  
  // Remove duplicates and return
  return Array.from(new Set(tags));
}

/**
 * Migrate all recipes to add tags
 */
async function migrateRecipeTags() {
  try {
    console.log('Starting recipe tagging migration...');
    
    const recipesRef = db.collection('recipes');
    const snapshot = await recipesRef.get();
    
    if (snapshot.empty) {
      console.log('No recipes found to migrate.');
      return;
    }
    
    console.log(`Found ${snapshot.size} recipes to process.`);
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    
    // Process in batches to avoid overwhelming Firestore
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore limit is 500 operations per batch
    
    for (const doc of snapshot.docs) {
      const recipe = doc.data();
      
      // Skip if recipe already has tags
      if (recipe.tags && recipe.tags.length > 0) {
        skipped++;
        processed++;
        continue;
      }
      
      // Generate tags
      const tags = generateRecipeTags(recipe);
      
      if (tags.length > 0) {
        // Add update to batch
        batch.update(doc.ref, { tags: tags });
        batchCount++;
        updated++;
        
        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`Processed ${processed} recipes, updated ${updated}...`);
          batchCount = 0;
        }
      } else {
        skipped++;
      }
      
      processed++;
      
      // Log progress every 100 recipes
      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${snapshot.size} recipes processed...`);
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log('\nMigration complete!');
    console.log(`Total recipes processed: ${processed}`);
    console.log(`Recipes updated with tags: ${updated}`);
    console.log(`Recipes skipped (already had tags or no tags generated): ${skipped}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// Run the migration
migrateRecipeTags()
  .then(() => {
    console.log('Migration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

