# Migration Script Instructions

## Quick Start

### 1. Verify Setup
```bash
node scripts/verify-setup.js
```

### 2. Run Recipe Tagging Migration
```bash
node scripts/migrate-recipe-tags.js
```

## What the Script Does

The `migrate-recipe-tags.js` script:

1. ✅ Connects to Firestore using your service account
2. ✅ Fetches all recipes from the database
3. ✅ For each recipe without tags:
   - Analyzes ingredients (protein, vegetables, carbs, dairy, spicy, sweet)
   - Analyzes recipe name (breakfast, dessert, salad, soup)
   - Analyzes cuisine type (Italian, Mexican, Asian)
   - Analyzes cooking methods (grilled, baked, fried, slow-cooked)
   - Calculates complexity (simple, quick)
4. ✅ Updates recipes with generated tags
5. ✅ Processes in batches (500 at a time)
6. ✅ Skips recipes that already have tags (safe to run multiple times)

## Tag Categories

The script generates tags in these categories:

### Dietary Tags
- `protein` - Contains meat/fish
- `vegetables` - Contains vegetables
- `carbs` - Contains pasta/rice/bread
- `dairy` - Contains cheese/milk/cream
- `spicy` - Contains spicy ingredients
- `sweet` - Contains sweet ingredients

### Cooking Method Tags
- `grilled` - Grilled recipes
- `baked` - Baked recipes
- `fried` - Fried recipes
- `slow-cooked` - Slow-cooked recipes

### Meal Type Tags
- `breakfast` - Breakfast recipes
- `dessert` - Dessert recipes
- `salad` - Salad recipes
- `soup` - Soup/stew recipes

### Cuisine Tags
- `italian` - Italian cuisine
- `mexican` - Mexican cuisine
- `asian` - Asian cuisine

### Complexity Tags
- `simple` - 5 or fewer ingredients
- `quick` - 3 or fewer ingredients

## Example Output

```
Starting recipe tagging migration...
Found 150 recipes to process.
Progress: 100/150 recipes processed...
Processed 150 recipes, updated 142...
Migration complete!
Total recipes processed: 150
Recipes updated with tags: 142
Recipes skipped (already had tags or no tags generated): 8
Migration script completed successfully.
```

## Safety Features

✅ **Idempotent**: Safe to run multiple times
✅ **Batch Processing**: Respects Firestore limits
✅ **Error Handling**: Catches and reports errors
✅ **Progress Logging**: Shows progress every 100 recipes

## Troubleshooting

### Error: "Service account key not found"
**Solution**: 
1. Download service account key from Firebase Console
2. Place at: `~/.firebase-credentials/service-account-key.json`
3. Or: `scripts/credentials/service-account-key.json`

### Error: "Permission denied"
**Solution**: 
```bash
chmod 600 ~/.firebase-credentials/service-account-key.json
```

### Error: "Invalid service account credentials"
**Solution**: 
- Verify JSON file is valid
- Check that you downloaded the correct key
- Try generating a new key

### Script runs but no recipes updated
**Possible reasons**:
- All recipes already have tags
- Recipes don't match tagging criteria
- Check console output for "skipped" count

## Next Steps

After running the tagging migration:
1. Verify tags in Firebase Console
2. Test recipe filtering by tags in the app
3. Consider running the data migration (adding userId fields) if not done yet

