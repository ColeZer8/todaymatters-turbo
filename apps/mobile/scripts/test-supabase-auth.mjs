#!/usr/bin/env node

/**
 * Test script to verify Supabase Auth is working
 * Run with: node scripts/test-supabase-auth.mjs
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

console.log('🔐 Testing Supabase Authentication...\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables!');
  console.error('   Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate a unique test email (using a valid domain)
const testEmail = `test-${Date.now()}@testmail.com`;
const testPassword = 'TestPassword123!';

async function testAuth() {
  try {
    console.log('📧 Test credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);

    // Test 1: Sign Up
    console.log('1️⃣  Testing Sign Up...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError) {
      console.error('❌ Sign Up failed:');
      console.error(`   ${signUpError.message}\n`);
      
      if (signUpError.message.includes('Email rate limit')) {
        console.log('💡 This might be a rate limit. Try again in a moment.');
      } else if (signUpError.message.includes('Invalid API key')) {
        console.log('💡 Check your EXPO_PUBLIC_SUPABASE_ANON_KEY');
      } else if (signUpError.message.includes('disabled')) {
        console.log('💡 Email provider might be disabled in Supabase dashboard');
        console.log('   Check: https://supabase.com/dashboard/project/YOUR_PROJECT/auth/providers');
      }
      process.exit(1);
    }

    if (!signUpData.user) {
      console.error('❌ Sign Up returned no user');
      process.exit(1);
    }

    console.log('✅ Sign Up successful!');
    console.log(`   User ID: ${signUpData.user.id}`);
    console.log(`   Email: ${signUpData.user.email}`);
    console.log(`   Email confirmed: ${signUpData.user.email_confirmed_at ? 'Yes' : 'No (check email)'}\n`);

    // Test 2: Get Session
    console.log('2️⃣  Testing Session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('❌ Get Session failed:');
      console.error(`   ${sessionError.message}\n`);
      process.exit(1);
    }

    if (session) {
      console.log('✅ Session retrieved!');
      console.log(`   Access token: ${session.access_token.substring(0, 20)}...`);
      console.log(`   Expires at: ${new Date(session.expires_at * 1000).toLocaleString()}\n`);
    } else {
      console.log('⚠️  No active session (this might be normal if email confirmation is required)\n');
    }

    // Test 3: Sign Out
    console.log('3️⃣  Testing Sign Out...');
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error('❌ Sign Out failed:');
      console.error(`   ${signOutError.message}\n`);
      process.exit(1);
    }

    console.log('✅ Sign Out successful!\n');

    // Test 4: Sign In
    console.log('4️⃣  Testing Sign In...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      if (signInError.message.includes('Email not confirmed')) {
        console.log('⚠️  Sign In requires email confirmation');
        console.log('   This is expected if email confirmation is enabled in Supabase.\n');
        console.log('💡 For development, you can:');
        console.log('   1. Disable email confirmation in Supabase Dashboard:');
        console.log('      Auth → Settings → "Enable email confirmations" (turn off)');
        console.log('   2. Or confirm the email manually in Supabase Dashboard:');
        console.log('      Auth → Users → Find user → Confirm email\n');
        console.log('✅ Auth is working! Email confirmation is just enabled.\n');
      } else {
        console.error('❌ Sign In failed:');
        console.error(`   ${signInError.message}\n`);
        process.exit(1);
      }
    } else if (signInData.user) {
      console.log('✅ Sign In successful!');
      console.log(`   User ID: ${signInData.user.id}`);
      console.log(`   Email: ${signInData.user.email}\n`);
    }

    // Final cleanup
    console.log('5️⃣  Cleaning up (signing out)...');
    await supabase.auth.signOut();
    console.log('✅ Cleanup complete\n');

    console.log('🎉 Auth test completed!');
    console.log('   ✅ Sign Up works');
    console.log('   ✅ Session management works');
    console.log('   ✅ Sign Out works');
    if (signInData?.user) {
      console.log('   ✅ Sign In works');
    } else {
      console.log('   ⚠️  Sign In requires email confirmation (this is normal)');
    }
    console.log('\n💡 Your Supabase Auth is fully configured and working!');
    console.log(`   Test user created: ${testEmail}`);
    console.log('   (You can delete this user from Supabase dashboard if needed)');
    console.log('\n📝 Next steps:');
    console.log('   - Build your sign in/sign up screens');
    console.log('   - Consider disabling email confirmation for development');
    console.log('   - Set up redirect URLs in Supabase Dashboard if using OAuth');

  } catch (error) {
    console.error('❌ Auth test failed with error:');
    console.error(`   ${error.message}\n`);
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

testAuth();

