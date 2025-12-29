/**
 * Recipe Creation Logger
 * 
 * Utility functions for logging recipe creation events.
 * Helps with debugging and monitoring recipe additions.
 * 
 * NOTE: All logging functions have been updated to remove sensitive information
 * such as user IDs and email addresses. This logger now uses secure logging.
 */

import { secureLog, secureWarn, secureError } from './secureLogger';

/**
 * Log recipe creation attempt
 * 
 * @deprecated Use secureLog directly in App.tsx for better control
 */
export const logRecipeCreationAttempt = (recipeData: {
  name: string;
  cuisine: string;
  ingredientCount: number;
  userId?: string;
  userEmail?: string;
}) => {
  const logEntry = {
    event: 'RECIPE_CREATION_ATTEMPT',
    timestamp: new Date().toISOString(),
    recipe: {
      name: recipeData.name,
      cuisine: recipeData.cuisine,
      ingredientCount: recipeData.ingredientCount
    }
    // Note: userId and userEmail are intentionally excluded for security
  };
  
  secureLog('[Recipe Logger]', logEntry);
  return logEntry;
};

/**
 * Log successful recipe creation
 * 
 * @deprecated Use secureLog directly in App.tsx for better control
 */
export const logRecipeCreationSuccess = (recipeData: {
  recipeId?: string;
  name: string;
  cuisine: string;
  tags: string[];
  userId?: string;
  userEmail?: string;
}) => {
  const logEntry = {
    event: 'RECIPE_CREATION_SUCCESS',
    timestamp: new Date().toISOString(),
    recipe: {
      // Note: recipeId excluded for security (Firebase document IDs can be sensitive)
      name: recipeData.name,
      cuisine: recipeData.cuisine,
      tagsCount: recipeData.tags.length
    }
    // Note: userId and userEmail are intentionally excluded for security
  };
  
  secureLog('[Recipe Logger]', logEntry);
  return logEntry;
};

/**
 * Log recipe creation error
 * 
 * @deprecated Use secureError directly in App.tsx for better control
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
      recipeName: error.recipeName || 'unknown'
      // Note: userId is intentionally excluded for security
    }
  };
  
  secureError('[Recipe Logger]', logEntry);
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
      errorsCount: validation.errors.length
    },
    recipe: {
      name: validation.recipeName
    }
  };
  
  if (!validation.isValid) {
    secureWarn('[Recipe Logger]', logEntry);
  } else {
    secureLog('[Recipe Logger]', logEntry);
  }
  
  return logEntry;
};
