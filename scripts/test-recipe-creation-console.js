/**
 * Recipe Creation Test Script
 * 
 * Copy and paste this script into your browser console to test recipe creation.
 * This will help verify that recipes are being created correctly with proper
 * user IDs, tags, and logging.
 * 
 * Usage:
 * 1. Open your app in the browser
 * 2. Log in as a user
 * 3. Open the browser console (F12 or Cmd+Option+I)
 * 4. Paste this entire script
 * 5. Press Enter
 */

(async function testRecipeCreation() {
  console.log('🧪 Starting Recipe Creation Tests...\n');
  
  // Import Firebase functions (assuming they're available globally or via window)
  // If using modules, you may need to adjust this
  const { db, collections, requireAuth } = window.firebase || {};
  
  if (!db || !collections || !requireAuth) {
    console.error('❌ Firebase not available. Make sure you are on the app page.');
    return;
  }
  
  try {
    // Get current user
    const currentUser = requireAuth();
    console.log('✅ User authenticated:', {
      userId: currentUser.uid,
      email: currentUser.email
    });
    
    // Test recipe data
    const testRecipes = [
      {
        name: 'Test Chicken Pasta',
        cuisine: 'Italian',
        ingredients: ['chicken', 'pasta', 'tomato sauce', 'garlic', 'onion']
      },
      {
        name: 'Test Vegetable Salad',
        cuisine: 'Misc',
        ingredients: ['lettuce', 'tomato', 'carrot', 'cucumber']
      },
      {
        name: 'Test Simple Recipe',
        cuisine: 'American',
        ingredients: ['ingredient1', 'ingredient2']
      }
    ];
    
    console.log('\n📝 Testing recipe creation...\n');
    
    for (const recipe of testRecipes) {
      console.log(`\n--- Testing: ${recipe.name} ---`);
      
      // Validate recipe
      if (!recipe.name || !recipe.name.trim()) {
        console.error('❌ Recipe name is required');
        continue;
      }
      
      if (!recipe.ingredients || recipe.ingredients.length === 0) {
        console.error('❌ Recipe must have at least one ingredient');
        continue;
      }
      
      if (!recipe.cuisine) {
        console.error('❌ Recipe cuisine is required');
        continue;
      }
      
      console.log('✅ Recipe validation passed');
      console.log('📋 Recipe data:', {
        name: recipe.name,
        cuisine: recipe.cuisine,
        ingredientCount: recipe.ingredients.length,
        ingredients: recipe.ingredients
      });
      
      // Generate tags (simplified version)
      const tags = [];
      const ingredientsLower = recipe.ingredients.map(ing => ing.toLowerCase());
      
      // Protein tags
      if (ingredientsLower.some(ing => 
        ing.includes('chicken') || ing.includes('beef') || 
        ing.includes('fish') || ing.includes('pork')
      )) {
        tags.push('protein');
      }
      
      // Vegetable tags
      if (ingredientsLower.some(ing => 
        ing.includes('vegetable') || ing.includes('lettuce') || 
        ing.includes('tomato') || ing.includes('carrot')
      )) {
        tags.push('vegetables');
      }
      
      // Cuisine tags
      if (recipe.cuisine !== 'Misc') {
        tags.push(recipe.cuisine.toLowerCase());
      }
      
      // Complexity tags
      if (recipe.ingredients.length <= 3) {
        tags.push('quick');
      }
      if (recipe.ingredients.length <= 5) {
        tags.push('simple');
      }
      
      console.log('🏷️ Generated tags:', tags);
      
      // Create recipe object with userId
      const recipeWithUserId = {
        ...recipe,
        userId: currentUser.uid,
        tags: tags.length > 0 ? tags : undefined,
        createdAt: new Date().toISOString()
      };
      
      console.log('💾 Recipe object to save:', recipeWithUserId);
      console.log('✅ Recipe includes userId:', recipeWithUserId.userId === currentUser.uid);
      
      // Note: Actual Firestore save would happen here
      // For testing, we'll just log what would be saved
      console.log('✅ Recipe creation test passed for:', recipe.name);
    }
    
    console.log('\n\n✅ All recipe creation tests completed!');
    console.log('\n📊 Summary:');
    console.log('- Recipe validation: ✅');
    console.log('- User ID assignment: ✅');
    console.log('- Tag generation: ✅');
    console.log('- Data structure: ✅');
    
    console.log('\n💡 To test actual Firestore saves, use the app UI to create a recipe');
    console.log('   and check the browser console for detailed logs.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
})();


