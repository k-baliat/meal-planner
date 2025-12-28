/**
 * Data Validation Utilities
 * 
 * Functions to validate that meal plans and shopping lists are user-specific.
 * These validations ensure data integrity and prevent cross-user data access.
 */

import { requireAuth } from '../firebase';

/**
 * Validate that a meal plan document ID includes userId
 */
export const validateMealPlanDocId = (docId: string, expectedUserId: string): boolean => {
  // Meal plan document IDs should be in format: {userId}_{weekRange}
  if (!docId.includes('_')) {
    console.error('[Validation] Meal plan document ID missing underscore:', docId);
    return false;
  }
  
  const userIdFromDocId = docId.split('_')[0];
  if (userIdFromDocId !== expectedUserId) {
    console.error('[Validation] Meal plan document ID userId mismatch:', {
      docId: docId,
      expectedUserId: expectedUserId,
      foundUserId: userIdFromDocId
    });
    return false;
  }
  
  return true;
};

/**
 * Validate that a shopping list document ID includes userId
 */
export const validateShoppingListDocId = (docId: string, expectedUserId: string): boolean => {
  // Shopping list document IDs should be in format: {userId}_{weekRange}
  if (!docId.includes('_')) {
    console.error('[Validation] Shopping list document ID missing underscore:', docId);
    return false;
  }
  
  const userIdFromDocId = docId.split('_')[0];
  if (userIdFromDocId !== expectedUserId) {
    console.error('[Validation] Shopping list document ID userId mismatch:', {
      docId: docId,
      expectedUserId: expectedUserId,
      foundUserId: userIdFromDocId
    });
    return false;
  }
  
  return true;
};

/**
 * Validate that a document has userId field
 */
export const validateDocumentHasUserId = (document: any, documentType: string): boolean => {
  if (!document.userId) {
    console.error(`[Validation] ${documentType} document missing userId:`, document);
    return false;
  }
  
  const currentUser = requireAuth();
  if (document.userId !== currentUser.uid) {
    console.error(`[Validation] ${documentType} document userId mismatch:`, {
      documentUserId: document.userId,
      currentUserId: currentUser.uid
    });
    return false;
  }
  
  return true;
};

/**
 * Validate meal plan data before saving
 */
export const validateMealPlan = (mealPlan: any, weekRange: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!weekRange || !weekRange.trim()) {
    errors.push('Week range is required');
  }
  
  const currentUser = requireAuth();
  if (!currentUser) {
    errors.push('User must be authenticated');
  }
  
  // Check that meal plan has at least one day
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hasAtLeastOneDay = days.some(day => mealPlan[day]);
  
  if (!hasAtLeastOneDay) {
    // This is a warning, not an error - empty meal plans are allowed
    console.warn('[Validation] Meal plan has no meals assigned');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate shopping list data before saving
 */
export const validateShoppingList = (shoppingList: any, weekRange: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!weekRange || !weekRange.trim()) {
    errors.push('Week range is required');
  }
  
  const currentUser = requireAuth();
  if (!currentUser) {
    errors.push('User must be authenticated');
  }
  
  if (!Array.isArray(shoppingList.checkedItems)) {
    errors.push('checkedItems must be an array');
  }
  
  if (!Array.isArray(shoppingList.miscItems)) {
    errors.push('miscItems must be an array');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Log validation results
 */
export const logValidation = (type: string, isValid: boolean, errors: string[]) => {
  if (isValid) {
    console.log(`[Validation] ✅ ${type} validation passed`);
  } else {
    console.warn(`[Validation] ⚠️ ${type} validation failed:`, errors);
  }
};


