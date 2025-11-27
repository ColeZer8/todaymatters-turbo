# How to Generate TypeScript Types from Supabase

## Method 1: Using CLI with Access Token (Recommended)

### Step 1: Get Your Access Token

1. Go to: https://supabase.com/dashboard/account/tokens
2. Click **"Generate new token"**
3. Give it a name (e.g., "Type Generation")
4. Copy the token (you'll only see it once!)

### Step 2: Generate Types

Run this command (replace `YOUR_TOKEN` with the token you copied):

```bash
cd apps/mobile
SUPABASE_ACCESS_TOKEN=YOUR_TOKEN npx supabase gen types typescript --project-id bqbbuysyiyzdtftctvdk > src/lib/supabase/database.types.ts
```

Or use the script:
```bash
cd apps/mobile
SUPABASE_ACCESS_TOKEN=YOUR_TOKEN node scripts/generate-types.mjs
```

## Method 2: Alternative - Use SQL Editor

If the above doesn't work, you can query your schema directly and I can help you create the types manually. Just share:
- What tables you have
- The columns in each table

## After Generating Types

Update `apps/mobile/src/lib/supabase/client.ts`:

```typescript
import { Database } from './database.types';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  // ... existing config
});
```
