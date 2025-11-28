#!/usr/bin/env node

/**
 * Generate TypeScript types from Supabase database schema
 * 
 * Option 1: Use access token (recommended)
 *   1. Get your access token from: https://supabase.com/dashboard/account/tokens
 *   2. Run: SUPABASE_ACCESS_TOKEN=your-token node scripts/generate-types.mjs
 * 
 * Option 2: Use Supabase dashboard
 *   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api
 *   2. Scroll to "TypeScript types" section
 *   3. Copy the generated types and paste into src/lib/supabase/database.types.ts
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectId = process.env.SUPABASE_PROJECT_ID || 'bqbbuysyiyzdtftctvdk';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

const outputPath = join(__dirname, '../src/lib/supabase/database.types.ts');

console.log('🔍 Generating TypeScript types from Supabase schema...\n');

if (!accessToken) {
  console.log('❌ SUPABASE_ACCESS_TOKEN not found in environment variables.\n');
  console.log('📋 To generate types, you have two options:\n');
  console.log('Option 1: Use Supabase CLI with access token');
  console.log('  1. Get your access token from: https://supabase.com/dashboard/account/tokens');
  console.log(`  2. Run: SUPABASE_ACCESS_TOKEN=your-token node scripts/generate-types.mjs\n`);
  console.log('Option 2: Use Supabase Dashboard (Easiest)');
  console.log(`  1. Go to: https://supabase.com/dashboard/project/${projectId}/settings/api`);
  console.log('  2. Scroll to "TypeScript types" section');
  console.log('  3. Click "Generate types" or copy the types');
  console.log(`  4. Paste into: ${outputPath}\n`);
  process.exit(1);
}

try {
  console.log(`📦 Generating types for project: ${projectId}...\n`);
  
  // Set the access token and run the command
  process.env.SUPABASE_ACCESS_TOKEN = accessToken;
  
  const command = `npx supabase gen types typescript --project-id ${projectId}`;
  const types = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
  
  // Write to file
  const fs = await import('fs/promises');
  await fs.writeFile(outputPath, types, 'utf-8');
  
  console.log(`✅ Types generated successfully!`);
  console.log(`   Saved to: ${outputPath}\n`);
  console.log('📝 Next step: Update src/lib/supabase/client.ts to use these types');
  
} catch (error) {
  console.error('❌ Failed to generate types:');
  console.error(`   ${error.message}\n`);
  
  if (error.message.includes('access')) {
    console.log('💡 Make sure your access token is valid and has the right permissions.');
    console.log('   Get a new token from: https://supabase.com/dashboard/account/tokens\n');
  }
  
  process.exit(1);
}


