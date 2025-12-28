/**
 * Recipe Creation Logger
 * 
 * Utility functions for logging recipe creation events.
 * Helps with debugging and monitoring recipe additions.
 */

/**
 * Log recipe creation attempt
 */
export const logRecipeCreationAttempt = (recipeData: {
  name: string;
  cuisine: string;
  ingredientCount: number;
  userId: string;
  userEmail?: string;
}) => {
  const logEntry = {
    event: 'RECIPE_CREATION_ATTEMPT',
    timestamp: new Date().toISOString(),
    recipe: {
      name: recipeData.name,
      cuisine: recipeData.cuisine,
      ingredientCount: recipeData.ingredientCount
    },
    user: {
      userId: recipeData.userId,
      email: recipeData.userEmail || 'unknown'
    }
  };
  
  console.log('[Recipe Logger]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log successful recipe creation
 */
export const logRecipeCreationSuccess = (recipeData: {
  recipeId: string;
  name: string;
  cuisine: string;
  tags: string[];
  userId: string;
  userEmail?: string;
}) => {
  const logEntry = {
    event: 'RECIPE_CREATION_SUCCESS',
    timestamp: new Date().toISOString(),
    recipe: {
      id: recipeData.recipeId,
      name: recipeData.name,
      cuisine: recipeData.cuisine,
      tags: recipeData.tags
    },
    user: {
      userId: recipeData.userId,
      email: recipeData.userEmail || 'unknown'
    }
  };
  
  console.log('[Recipe Logger]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log recipe creation error
 */
export const logRecipeCreationError = (error: {
  message: string;
  code?: string;
  recipeName?: string;
  userId?: string;
}) => {
  const logEntry = {
    event: 'RECIPE_CREATION_ERROR',
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      code: error.code || 'unknown'
    },
    context: {
      recipeName: error.recipeName || 'unknown',
      userId: error.userId || 'unknown'
    }
  };
  
  console.error('[Recipe Logger]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log recipe validation
 */
export const logRecipeValidation = (validation: {
  isValid: boolean;
  errors: string[];
  recipeName: string;
}) => {
  const logEntry = {
    event: 'RECIPE_VALIDATION',
    timestamp: new Date().toISOString(),
    validation: {
      isValid: validation.isValid,
      errors: validation.errors
    },
    recipe: {
      name: validation.recipeName
    }
  };
  
  if (!validation.isValid) {
    console.warn('[Recipe Logger]', JSON.stringify(logEntry, null, 2));
  } else {
    console.log('[Recipe Logger]', JSON.stringify(logEntry, null, 2));
  }
  
  return logEntry;
};

