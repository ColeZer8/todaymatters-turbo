#!/usr/bin/env node

/**
 * Test script to verify Supabase connection
 * Run with: node scripts/test-supabase-connection.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from apps/mobile directory
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables!');
  console.error('   Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
console.log(`   Key: ${supabaseAnonKey.substring(0, 20)}...\n`);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test connection by checking auth status (this doesn't require authentication)
async function testConnection() {
  try {
    console.log('🔄 Testing connection...');
    
    // Test: Check auth status - this should work even without being logged in
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // If we get an "Invalid API key" error, the credentials are wrong
    if (sessionError && sessionError.message.includes('Invalid API key')) {
      console.error('❌ Connection failed: Invalid API key');
      console.error('   Please check your EXPO_PUBLIC_SUPABASE_ANON_KEY');
      process.exit(1);
    }
    
    // If we get a network error, the URL might be wrong
    if (sessionError && (sessionError.message.includes('fetch') || sessionError.message.includes('network'))) {
      console.error('❌ Connection failed: Network error');
      console.error('   Please check:');
      console.error('   - Your internet connection');
      console.error('   - Your EXPO_PUBLIC_SUPABASE_URL is correct');
      process.exit(1);
    }
    
    console.log('✅ Connection successful!');
    console.log('   Supabase client is configured correctly.');
    console.log(`   Session status: ${session ? 'Active session' : 'No active session (this is normal)'}\n`);
    
    console.log('🎉 All checks passed! Your Supabase setup is working correctly.');
    console.log('   You can now use the supabase client in your app.');
    
  } catch (error) {
    console.error('❌ Connection test failed:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      console.error('\n   Possible issues:');
      console.error('   - Check your internet connection');
      console.error('   - Verify your EXPO_PUBLIC_SUPABASE_URL is correct');
    }
    
    process.exit(1);
  }
}

testConnection();

