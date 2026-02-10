#!/bin/bash
# Quick script to fix Paul's duplicate meetings
# Usage: ./fix-paul.sh <user_id> [--delete]
# Example (dry run): ./fix-paul.sh 79a6e69a-e07e-4e67-a069-50f6b74a8c13
# Example (delete):  ./fix-paul.sh 79a6e69a-e07e-4e67-a069-50f6b74a8c13 --delete

cd "$(dirname "$0")"

# Load env vars
export $(grep EXPO_PUBLIC_SUPABASE apps/mobile/.env | xargs)

# Run the TypeScript script from the apps/mobile context
cd apps/mobile
npx ts-node ../../scripts/fix-paul-duplicates.ts "$@"
