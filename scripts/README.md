# Migration Scripts Directory

This directory contains scripts for migrating your Firestore data.

## Important Security Notice

⚠️ **NEVER commit service account keys to Git!**

Service account keys have full admin access to your Firebase project. Keep them secure:
- Store outside the project directory (recommended: `~/.firebase-credentials/`)
- Or if stored here, ensure `scripts/credentials/` is in `.gitignore`
- Set file permissions to 600 (read/write for owner only)

## Available Scripts

### Data Migration (Coming Soon)
- `migrate-data.js` - Migrates existing data to multi-user structure

### Recipe Tagging
- `migrate-recipe-tags.js` - Adds automatic tags to existing recipes

## Usage

See `FIREBASE_MIGRATION_SETUP.md` in the project root for detailed setup instructions.

