# Migration & Data Architecture Q&A

## Quick Answers to Your Questions

### 1. How will shopping lists and meal plans aggregate ingredients for a user/week?

**Answer**: ✅ **Already Implemented Correctly**

**How it works**:
1. Each user's meal plans are stored with document ID: `{userId}_{weekRange}`
2. When generating a shopping list:
   - System fetches the user's meal plan for that week
   - Extracts recipe IDs from each day (can have multiple recipes per day)
   - Looks up each recipe in the recipes array (includes user's recipes + shared recipes)
   - Aggregates all ingredients, counting duplicates
   - Returns formatted list: `["ingredient1 (x2)", "ingredient2 (x1)", ...]`

**Code Location**: `getAggregatedIngredients()` function in `App.tsx` (line ~840)

**Example Flow**:
```
User: user123
Week: "March 23 2025 - March 29 2025"
Meal Plan: { Monday: "recipe1,recipe2", Tuesday: "recipe3", ... }

Step 1: Get meal plan → docId = "user123_March 23 2025 - March 29 2025"
Step 2: For Monday → recipe1 + recipe2
Step 3: Get ingredients from recipe1 and recipe2
Step 4: Aggregate and count: "chicken (x2)", "onion (x1)", ...
Step 5: Display in shopping list
```

**Key Points**:
- ✅ User-specific: Each user only sees their own meal plans
- ✅ Shared recipes work: If a shared recipe is in the meal plan, its ingredients are included
- ✅ Multiple recipes per day: Handles comma-separated recipe IDs
- ✅ Ingredient deduplication: Same ingredient from multiple recipes is counted

---

### 2. Will user notes for each recipe be tagged with the recipe?

**Answer**: ⚠️ **Current Issue - Needs Fix**

**Current Problem**:
- Recipe notes are stored as a single field: `notes?: string`
- This means ALL users see the same notes (not user-specific)
- If User A adds notes, User B sees them too

**Recommended Solution**: **Per-User Recipe Notes**

**Option A: Subcollection (Recommended)**
```
recipes/{recipeId}
  └── (recipe data)

recipeNotes/{noteId}
  ├── recipeId: "recipe123"
  ├── userId: "user456"
  ├── notes: "I like to add extra garlic"
  └── timestamps
```

**Option B: Map Structure (Simpler)**
```typescript
interface Recipe {
  userNotes?: {
    [userId: string]: string;  // Each user has their own notes
  }
}
```

**Recommendation**: Use **Option A (Subcollection)** because:
- ✅ Better scalability (recipe document doesn't grow)
- ✅ Can track note history
- ✅ Easier to query "my notes for this recipe"
- ✅ No document size limits

**Implementation Needed**:
- Create `recipeNotes` collection
- Update UI to load/save notes per user
- Update queries to fetch user's notes for each recipe

---

### 3. How will we handle user sharing for recipes?

**Answer**: ✅ **Structure Exists, UI Needed**

**Current Implementation**:
```typescript
interface Recipe {
  userId: string;           // Owner
  sharedWith?: string[];     // Array of user IDs with access
}
```

**How It Works**:
1. **Owner shares recipe**: Adds recipient's user ID to `sharedWith` array
2. **Recipient sees recipe**: Query includes recipes where `sharedWith.includes(theirUserId)`
3. **Security**: Firestore rules allow read if user owns OR is in `sharedWith` array

**What's Missing**:
1. **UI Component**: 
   - Input field for email address
   - Button to share recipe
   - List of users recipe is shared with
   - Unshare button

2. **User Lookup**:
   - Need to find user ID from email address
   - Options:
     - Create `users` collection: `{ email: string, uid: string }`
     - Use Firebase Admin SDK (server-side function)
     - Ask user for their user ID (not user-friendly)

3. **Permissions** (Optional):
   - Currently: Read-only sharing
   - Future: Read-write sharing
   - Would need: `sharedWithPermissions?: { [userId: string]: 'read' | 'write' }`

**Recommended Structure**:
```typescript
interface Recipe {
  userId: string;
  sharedWith?: string[];  // Simple: array of user IDs (read-only)
  
  // OR for advanced permissions:
  sharedWithDetails?: {
    [userId: string]: {
      permission: 'read' | 'write';
      sharedAt: Timestamp;
      sharedBy: string;
    }
  }
}
```

---

### 4. [Your question was cut off - please clarify]

Based on context, you might be asking about:

**4a. How will recipes be filtered/searched?**
- By cuisine (already implemented)
- By tags (structure exists, UI needed)
- By name (needs search functionality)
- By ingredients (needs search functionality)

**4b. How will data be migrated safely?**
- This will be addressed in Step 2 with:
  - Automatic backups
  - Dry-run mode
  - Rollback capabilities
  - Detailed logging

**4c. How will the app handle multiple users?**
- Each user has isolated data (userId filtering)
- Shared recipes bridge users
- Security rules enforce isolation

Please let me know what question #4 was about!

---

## Data Model Summary

### Recipe Structure (Recommended)
```typescript
interface Recipe {
  // Core
  id: string;
  name: string;
  cuisine: string;
  ingredients: string[];
  
  // Ownership
  userId: string;              // Owner
  createdBy?: string;          // User email/name (for display)
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  
  // Sharing
  sharedWith?: string[];        // User IDs with access
  
  // Metadata
  tags?: string[];             // Auto-generated tags
}
```

### Recipe Notes (Separate Collection)
```typescript
interface RecipeNote {
  id: string;
  recipeId: string;            // Reference to recipe
  userId: string;               // Owner of notes
  notes: string;                // Notes content
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Meal Plan Structure
```typescript
interface WeeklyMealPlan {
  // Document ID: {userId}_{weekRange}
  Monday: string;              // "recipeId1,recipeId2"
  Tuesday: string;
  // ... other days
  userId: string;
  weekRange: string;
}
```

### Shopping List Structure
```typescript
interface ShoppingList {
  // Document ID: {userId}_{weekRange}
  weekRange: string;
  userId: string;
  checkedItems: string[];      // Checked ingredients
  miscItems: string[];          // Miscellaneous items
}
```

---

## Action Items

### Immediate (Before Migration)
1. ✅ Review migration script (done)
2. ✅ Understand data structure (done)
3. ⏳ Fix recipe notes to be per-user (needs implementation)
4. ⏳ Add sharing UI (needs implementation)

### After Migration
1. Test recipe tagging
2. Verify shopping list aggregation
3. Test recipe sharing
4. Implement per-user recipe notes

---

## Next Steps

1. **Run Recipe Tagging Migration**:
   ```bash
   node scripts/migrate-recipe-tags.js
   ```

2. **Fix Recipe Notes** (if you want per-user notes):
   - I can implement the subcollection structure
   - Update UI to load/save per-user notes

3. **Add Sharing UI**:
   - Create share component
   - Implement user lookup
   - Add share/unshare functionality

4. **Data Migration** (Step 2):
   - Create safe migration script with backups
   - Add dry-run mode
   - Add rollback capabilities

Let me know which you'd like to tackle first!

