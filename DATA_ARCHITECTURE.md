# Data Architecture & Migration Guide

This document explains the complete data structure, how migrations work, and answers key questions about multi-user functionality.

## Table of Contents

1. [Migration Script Review](#migration-script-review)
2. [How to Run the Migration](#how-to-run-the-migration)
3. [Data Structure Overview](#data-structure-overview)
4. [Shopping List & Meal Plan Aggregation](#shopping-list--meal-plan-aggregation)
5. [Recipe Notes Architecture](#recipe-notes-architecture)
6. [Recipe Sharing Implementation](#recipe-sharing-implementation)
7. [Complete Data Model](#complete-data-model)

---

## Migration Script Review

### Current Script: `migrate-recipe-tags.js`

**Purpose**: Adds automatic tags to existing recipes based on ingredients, cuisine, and name.

**Review Findings**:

✅ **Correct Aspects**:
- Uses batch operations (efficient, respects Firestore limits)
- Skips recipes that already have tags (idempotent)
- Matches frontend tagging logic exactly
- Proper error handling
- Progress logging

⚠️ **Issues Found**:
1. **Hardcoded Service Account Path**: Line 15 has a hardcoded path that needs to be updated
2. **No Dry-Run Mode**: Can't test without making changes
3. **No Backup**: Doesn't create backup before modifying data
4. **No Validation**: Doesn't verify recipe structure before processing

**Recommendation**: The script is functional but needs safety improvements (which we'll add in Step 2).

---

## How to Run the Migration

### Prerequisites

1. ✅ Firebase Admin SDK installed (`npm install firebase-admin`)
2. ✅ Service account key downloaded and secured
3. ✅ Service account key path configured in script

### Step-by-Step Instructions

1. **Update Service Account Path**:
   ```javascript
   // In scripts/migrate-recipe-tags.js, line 15
   const serviceAccount = require('/path/to/your/service-account-key.json');
   ```

2. **Verify Setup**:
   ```bash
   node scripts/verify-setup.js
   ```

3. **Run the Migration**:
   ```bash
   node scripts/migrate-recipe-tags.js
   ```

4. **Expected Output**:
   ```
   Starting recipe tagging migration...
   Found X recipes to process.
   Progress: 100/X recipes processed...
   ...
   Migration complete!
   Total recipes processed: X
   Recipes updated with tags: Y
   Recipes skipped: Z
   ```

### What the Script Does

1. Connects to Firestore using Admin SDK
2. Fetches all recipes from the `recipes` collection
3. For each recipe without tags:
   - Analyzes ingredients, name, and cuisine
   - Generates appropriate tags
   - Updates the recipe with tags
4. Processes in batches of 500 (Firestore limit)
5. Provides progress updates

---

## Data Structure Overview

### Current Collections

1. **recipes** - Recipe data with user ownership
2. **mealPlans** - Weekly meal plans (user-specific)
3. **shoppingLists** - Shopping lists (user-specific)
4. **notes** - Daily notes (user-specific)

---

## Shopping List & Meal Plan Aggregation

### How It Works

**Current Implementation** (in `getAggregatedIngredients` function):

1. **User-Specific Meal Plans**:
   - Meal plans are stored with document ID: `{userId}_{weekRange}`
   - Example: `user123_March 23 2025 - March 29 2025`
   - Each meal plan contains: `{ Monday: "recipeId1,recipeId2", Tuesday: "recipeId3", ..., userId: "user123" }`

2. **Aggregation Process**:
   ```typescript
   // 1. Get user's meal plan for the week
   const docId = `${userId}_${weekRange}`;
   const mealPlan = await getDoc(doc(db, 'mealPlans', docId));
   
   // 2. For each day in the meal plan:
   Object.entries(mealPlan).forEach(([day, mealIds]) => {
     // 3. Split comma-separated recipe IDs
     const recipeIds = mealIds.split(',');
     
     // 4. For each recipe ID, find the recipe
     recipeIds.forEach(recipeId => {
       const recipe = recipes.find(r => r.id === recipeId);
       
       // 5. Add each ingredient to aggregation map
       recipe.ingredients.forEach(ingredient => {
         // Normalize and count ingredients
         ingredientCounts.set(ingredient, count + 1);
       });
     });
   });
   
   // 6. Return aggregated list with counts
   return ["ingredient1 (x2)", "ingredient2 (x1)", ...]
   ```

3. **Recipe Access**:
   - Recipes are loaded from Firestore filtered by `userId`
   - Also includes recipes shared with the user (`sharedWith` array)
   - The aggregation function uses the in-memory `recipes` array

### Data Flow Diagram

```
User selects week
    ↓
Get meal plan: {userId}_{weekRange}
    ↓
Extract recipe IDs for each day
    ↓
Look up recipes in recipes array (user's + shared)
    ↓
Aggregate ingredients with counts
    ↓
Display in shopping list
```

### Important Points

✅ **User Isolation**: Each user's meal plans are completely separate
✅ **Shared Recipes Work**: If a shared recipe is in a meal plan, its ingredients are included
✅ **Ingredient Deduplication**: Same ingredient from multiple recipes is counted
✅ **Real-time Updates**: Uses Firestore listeners for live updates

---

## Recipe Notes Architecture

### Current Issue

**Problem**: Recipe notes are currently stored as a single field on the recipe:
```typescript
interface Recipe {
  notes?: string;  // ❌ This is shared across all users!
}
```

This means:
- If User A adds notes to a recipe, User B sees those notes
- Notes are not user-specific
- Shared recipes would show the owner's notes to everyone

### Recommended Solution: Per-User Recipe Notes

**Option 1: Subcollection (Recommended for Scalability)**

Create a separate collection for recipe notes:

```
recipes/{recipeId}
  ├── name: "Spaghetti"
  ├── ingredients: [...]
  └── (recipe data)

recipeNotes/{noteId}
  ├── recipeId: "recipe123"
  ├── userId: "user456"
  ├── notes: "I like to add extra garlic"
  └── createdAt: timestamp
```

**Pros**:
- ✅ True per-user notes
- ✅ Can have multiple notes per recipe (history)
- ✅ Doesn't bloat recipe documents
- ✅ Easy to query: "Get my notes for this recipe"

**Cons**:
- ⚠️ Requires additional query to load notes
- ⚠️ Slightly more complex data structure

**Option 2: Map Structure (Simpler, but Limited)**

Store notes as a map in the recipe:

```typescript
interface Recipe {
  userNotes?: {
    [userId: string]: string;  // userId -> notes mapping
  }
}
```

**Pros**:
- ✅ Simple structure
- ✅ Notes loaded with recipe
- ✅ No additional queries needed

**Cons**:
- ⚠️ Recipe document grows with each user's notes
- ⚠️ Limited to one note per user per recipe
- ⚠️ Can hit Firestore document size limits (1MB) with many users

### Recommended Implementation

**Use Option 1 (Subcollection)** for better scalability:

```typescript
// New collection: recipeNotes
interface RecipeNote {
  id?: string;
  recipeId: string;      // Reference to recipe
  userId: string;        // Owner of the notes
  notes: string;         // The actual notes
  createdAt: Timestamp;  // When notes were created/updated
  updatedAt: Timestamp;  // Last update time
}
```

**Query Pattern**:
```typescript
// Get user's notes for a recipe
const notesQuery = query(
  collection(db, 'recipeNotes'),
  where('recipeId', '==', recipeId),
  where('userId', '==', currentUserId)
);
```

---

## Recipe Sharing Implementation

### Current Structure

```typescript
interface Recipe {
  userId: string;           // Owner of the recipe
  sharedWith?: string[];     // Array of user IDs who can access this recipe
}
```

### How Sharing Works

1. **Owner Shares Recipe**:
   ```typescript
   // Add user ID to sharedWith array
   await updateDoc(recipeRef, {
     sharedWith: arrayUnion(recipientUserId)
   });
   ```

2. **Recipient Views Recipe**:
   ```typescript
   // Query includes:
   // - Recipes where userId === currentUserId (owned)
   // - Recipes where sharedWith.includes(currentUserId) (shared)
   ```

3. **Security Rules**:
   ```javascript
   // In firestore.rules
   allow read: if isAuthenticated() && (
     isOwner(getUserId()) || 
     canReadSharedRecipe(getUserId())  // Checks sharedWith array
   );
   ```

### Sharing Features Needed

**Current Status**: ✅ Basic structure exists, ⚠️ UI not implemented

**What's Needed**:

1. **Share UI Component**:
   - Input field for email address
   - Button to share recipe
   - List of users recipe is shared with
   - Option to unshare

2. **User Lookup**:
   - Need to find user ID from email address
   - Options:
     - Store email -> UID mapping in a `users` collection
     - Use Firebase Admin SDK to lookup by email (server-side)
     - Ask user to provide their user ID (not user-friendly)

3. **Share Permissions**:
   - Read-only (current): Shared users can view but not edit
   - Read-write (future): Shared users can edit recipe
   - Need to add `sharedWithPermissions?: { [userId: string]: 'read' | 'write' }`

### Recommended Sharing Structure

```typescript
interface Recipe {
  userId: string;                    // Owner
  sharedWith?: string[];              // Simple: array of user IDs (read-only)
  // OR for more control:
  sharedWithDetails?: {               // Advanced: with permissions
    [userId: string]: {
      permission: 'read' | 'write';
      sharedAt: Timestamp;
      sharedBy: string;  // Who shared it (usually the owner)
    }
  }
}
```

---

## Complete Data Model

### Recipe Collection

```typescript
interface Recipe {
  // Core fields
  id: string;                    // Firestore document ID
  name: string;                  // Recipe name
  cuisine: string;               // Cuisine type
  ingredients: string[];         // List of ingredients
  
  // Ownership & Sharing
  userId: string;                // Owner's user ID (REQUIRED)
  sharedWith?: string[];         // Array of user IDs with access
  createdAt?: Timestamp;         // When recipe was created
  updatedAt?: Timestamp;         // Last update time
  
  // Metadata
  tags?: string[];               // Auto-generated tags
  createdBy?: string;            // User email/name (for display)
  
  // Notes (if using Option 2 - map structure)
  userNotes?: {
    [userId: string]: string;    // Per-user notes
  }
}
```

### Recipe Notes Collection (Recommended)

```typescript
interface RecipeNote {
  id: string;                    // Firestore document ID
  recipeId: string;              // Reference to recipe
  userId: string;                // Owner of the notes
  notes: string;                 // The notes content
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Meal Plan Collection

```typescript
interface WeeklyMealPlan {
  // Document ID format: {userId}_{weekRange}
  // Example: "user123_March 23 2025 - March 29 2025"
  
  Monday: string;                // Comma-separated recipe IDs
  Tuesday: string;
  Wednesday: string;
  Thursday: string;
  Friday: string;
  Saturday: string;
  Sunday: string;
  userId: string;                // Owner's user ID (REQUIRED)
  weekRange: string;              // "March 23 2025 - March 29 2025"
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### Shopping List Collection

```typescript
interface ShoppingList {
  // Document ID format: {userId}_{weekRange}
  
  weekRange: string;            // "March 23 2025 - March 29 2025"
  userId: string;                // Owner's user ID (REQUIRED)
  checkedItems: string[];        // Array of checked ingredient strings
  miscItems: string[];           // Miscellaneous items
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### Notes Collection (Daily Notes)

```typescript
interface Note {
  id: string;                    // Firestore document ID
  date: string;                  // ISO date string: "2025-03-23"
  content: string;               // Note content
  userId: string;                // Owner's user ID (REQUIRED)
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

---

## Summary & Recommendations

### 1. Shopping List Aggregation ✅
**Status**: Already implemented correctly
- User-specific meal plans
- Aggregates ingredients from recipes (owned + shared)
- Handles multiple recipes per day
- Counts duplicate ingredients

### 2. Recipe Notes ⚠️
**Current**: Single `notes` field (shared across users)
**Recommended**: Separate `recipeNotes` subcollection
- True per-user notes
- Better scalability
- Can track note history

### 3. Recipe Sharing ✅
**Status**: Structure exists, UI needed
- `sharedWith` array works
- Security rules support it
- Need UI to add/remove shares
- Need user lookup by email

### 4. Additional Fields
**Recommended additions**:
- `createdBy` (user email/name for display)
- `createdAt` / `updatedAt` timestamps
- `sharedWithDetails` (if you want permissions)

---

## Next Steps

1. **Fix Recipe Notes**: Implement subcollection structure
2. **Add Sharing UI**: Create component to share recipes
3. **Add User Lookup**: Create users collection or use Admin SDK
4. **Enhance Migration**: Add safety features (backup, dry-run, rollback)

Would you like me to:
- Implement the recipe notes subcollection?
- Create the sharing UI component?
- Enhance the migration script with safety features?

