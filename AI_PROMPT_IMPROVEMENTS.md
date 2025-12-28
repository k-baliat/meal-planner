# AI Prompt Improvements - Recipe Links & Cooking Instructions

## Overview
Enhanced the AI chatbot's capabilities to handle recipe links/videos and to include cooking instructions in the recipe notes field.

## Changes Made

### 1. Recipe Link Parsing (`prompts.json`)

#### What Was Added:
Added capability for Chef Coco to parse and extract recipes from URLs and video links.

#### Location:
`src/prompts.json` → `systemPrompt` field

#### New Functionality:
```
**Your Role:**
5. Recipe Link Parsing: When users share recipe links or recipe video URLs, 
   analyze and extract the recipe details including name, ingredients, 
   cooking instructions, and relevant information
```

```
**When Handling Recipe Links or Videos:**
- If a user shares a URL to a recipe or recipe video, acknowledge it and 
  extract the recipe information
- Parse the content to identify recipe name, ingredients, cooking instructions, 
  and cuisine type
- Present the extracted recipe in an organized format
- Ask if they'd like to save it to their recipe library
```

#### How It Works:
1. User shares a recipe URL (e.g., from a cooking website or YouTube)
2. Chef Coco acknowledges the link
3. AI parses/extracts the recipe information from the link
4. Presents the recipe in a structured format
5. Offers to save it to the user's recipe library

#### Use Cases:
- **YouTube recipe videos**: "Can you get the recipe from this video: [URL]"
- **Recipe websites**: "I found this recipe online: [URL]"
- **Social media recipes**: "Extract this recipe: [URL]"

---

### 2. Cooking Instructions in Notes (`recipe-format.json`)

#### What Was Added:
Modified the `notes` field requirements to always include detailed cooking instructions.

#### Location:
`src/recipe-format.json` → `formatPrompt` field → Field Requirement #4

#### New Specification:
```
4. **notes** (string, optional): User-specific notes about the recipe. 
   This field should include:
   
   - **Cooking Instructions**: Always include step-by-step cooking 
     instructions in a clear, concise, and well-formatted manner. 
     Use numbered steps or clear paragraphs. Make instructions easy 
     to follow while cooking.
     
   - **Additional Information**: Also include user-provided notes, tips, 
     modifications, cooking tips, substitutions, serving suggestions, 
     prep/cook times, or personal preferences if available.
     
   - **Formatting**: Use line breaks (\n) to separate steps or sections 
     for readability. Keep instructions organized and scannable.
   
   If no cooking instructions or notes are available, omit this field entirely.
```

#### Updated Example:
The example recipe now includes properly formatted cooking instructions:

```json
{
  "name": "Classic Spaghetti Carbonara",
  "cuisine": "Italian",
  "ingredients": [...],
  "notes": "INSTRUCTIONS:\\n
    1. Bring a large pot of salted water to boil...\\n
    2. While pasta cooks, sauté pancetta...\\n
    3. In a bowl, whisk together eggs...\\n
    ...
    \\n\\n
    Prep time: 10 minutes\\n
    Cook time: 15 minutes\\n
    Serves: 4",
  "tags": [...]
}
```

#### Benefits:
1. **Complete Recipes**: Every saved recipe includes how to make it
2. **Well-Formatted**: Instructions are numbered and easy to follow
3. **Cooking-Friendly**: Clear step-by-step format perfect for following while cooking
4. **Additional Context**: Can include prep times, servings, and helpful tips

---

## Technical Details

### Files Modified:
1. **`src/prompts.json`**
   - Updated `systemPrompt` with recipe link parsing capabilities
   - Added role #5: Recipe Link Parsing
   - Added section: "When Handling Recipe Links or Videos"

2. **`src/recipe-format.json`**
   - Enhanced field requirement #4 (notes field)
   - Updated example output to demonstrate proper instruction formatting
   - Added emphasis on clear, concise formatting with line breaks

### JSON Validation:
✅ Both files are valid JSON
✅ No linting errors
✅ Properly escaped strings and line breaks

---

## Usage Examples

### Example 1: User Shares Recipe Link
**User**: "Hey Chef Coco, can you extract the recipe from this video: https://youtube.com/watch?v=..."

**Chef Coco Response**:
```
I've analyzed the video! Here's the recipe:

**Chicken Parmesan**

Ingredients:
- 2 chicken breasts
- 1 cup flour
- ...

Instructions:
1. Preheat oven to 375°F
2. Pound chicken breasts to even thickness
...

Would you like to save this to your recipe library?
```

### Example 2: Recipe with Full Instructions Saved
When a recipe is saved, the `notes` field now contains:
```
INSTRUCTIONS:
1. First step with clear action
2. Second step with timing
3. Third step with temperature
...

Prep time: 15 minutes
Cook time: 30 minutes
Serves: 4

Tips: You can substitute X for Y
```

---

## Benefits

### For Users:
✅ **Convenience**: Share recipe links instead of typing everything manually
✅ **Complete Information**: Recipes include full cooking instructions
✅ **Easy to Follow**: Step-by-step instructions are clearly formatted
✅ **Video Recipes**: Can save recipes from YouTube or other video platforms
✅ **Better Organization**: All recipe information in one place

### For the App:
✅ **Richer Data**: Recipes stored with comprehensive information
✅ **Better UX**: Users can actually cook from the saved recipes
✅ **Link Support**: Handles various recipe sources (websites, videos, blogs)
✅ **Consistent Format**: All recipes follow the same instruction structure
✅ **Future-Proof**: Ready for additional parsing improvements

---

## Future Enhancements (Optional)

### Potential Improvements:
- 🔗 Direct URL fetching and parsing (if API access available)
- 📹 Enhanced video transcript parsing
- 🖼️ Extract recipe images from links
- ⏱️ Automatically extract prep/cook times
- 🌟 Extract ratings/reviews if available
- 📊 Nutritional information extraction
- 🔄 Bulk import from multiple links
- 🌐 Multi-language recipe support

### Advanced Features:
- Real-time link preview
- Detect recipe format automatically (JSON-LD, schema.org)
- Smart ingredient quantity conversion
- Dietary restriction detection
- Difficulty level assessment

---

## Testing Recommendations

### Test Recipe Link Parsing:
1. Share a recipe URL from popular cooking sites (AllRecipes, Food Network, etc.)
2. Share a YouTube recipe video link
3. Share a blog post with embedded recipe
4. Test with various formats and structures

### Test Cooking Instructions:
1. Create a new recipe through chatbot
2. Verify `notes` field contains INSTRUCTIONS section
3. Check that instructions are numbered and well-formatted
4. Verify line breaks are properly rendered in UI
5. Test with simple and complex recipes

### Verify Edge Cases:
1. Recipe link with no clear instructions
2. Recipe with only ingredients (no steps)
3. Malformed URLs
4. Non-recipe links
5. Empty or minimal recipe data

---

## Notes for Developers

### Important Considerations:
1. **AI Limitations**: The AI can only extract information it can understand from the link context. It may not have real-time web access depending on the model.

2. **Line Breaks**: The `\n` characters in the notes field should be properly rendered as line breaks in the UI for readability.

3. **Notes Field Display**: Ensure your UI component displays the notes field with proper formatting (using `white-space: pre-wrap` in CSS).

4. **Character Limits**: Consider any database field length limits for the notes field since instructions can be lengthy.

5. **Error Handling**: The AI should gracefully handle cases where it cannot extract recipe information from a link.

### UI Display Suggestion:
Ensure the recipe notes are displayed with proper formatting in your recipe detail view:

```css
.recipe-notes-text {
  white-space: pre-wrap;  /* Preserves line breaks */
  line-height: 1.6;       /* Readable line spacing */
}
```

---

## Rollout Checklist

- ✅ Updated `prompts.json` with recipe link handling
- ✅ Updated `recipe-format.json` with instruction requirements
- ✅ Validated JSON syntax
- ✅ No linting errors
- ✅ Example output includes formatted instructions
- ⏳ Test with real recipe links (user testing)
- ⏳ Verify UI displays instructions properly
- ⏳ Collect user feedback on instruction clarity

---

**Last Updated**: December 28, 2025
**Status**: ✅ Complete and Ready for Testing

