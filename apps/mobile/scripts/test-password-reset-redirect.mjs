#!/usr/bin/env node

/**
 * Test script to verify password reset redirect URL is configured in Supabase
 * 
 * This script attempts to send a password reset email and checks if the redirect URL
 * is properly configured. If the redirect URL is not in Supabase's allowed list,
 * Supabase will return an error.
 * 
 * Usage:
 *   node apps/mobile/scripts/test-password-reset-redirect.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
const envPath = join(__dirname, '../../mobile/.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in apps/mobile/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PASSWORD_RESET_REDIRECT_URL = 'todaymatters://reset-password';

async function testPasswordResetRedirect() {
  console.log('🔍 Testing Password Reset Redirect URL Configuration\n');
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   Redirect URL: ${PASSWORD_RESET_REDIRECT_URL}\n`);

  // Use a test email (won't actually send if email doesn't exist)
  // But Supabase will still validate the redirect URL
  const testEmail = 'test@example.com';

  console.log('📧 Attempting to send password reset email...');
  console.log(`   Email: ${testEmail}`);
  console.log(`   Redirect URL: ${PASSWORD_RESET_REDIRECT_URL}\n`);

  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: PASSWORD_RESET_REDIRECT_URL,
    });

    if (error) {
      // Check for redirect URL errors
      if (error.message.includes('redirect_to') || error.message.includes('redirect URL') || error.message.includes('not allowed')) {
        console.error('❌ REDIRECT URL NOT CONFIGURED');
        console.error(`\n   Error: ${error.message}\n`);
        console.error('   ⚠️  The redirect URL is not in your Supabase allowed list!');
        console.error('\n   To fix this:');
        console.error('   1. Go to: https://supabase.com/dashboard/project/ysyiyzdtftctvdk/auth/url-configuration');
        console.error('   2. Under "Redirect URLs", add:');
        console.error(`      ${PASSWORD_RESET_REDIRECT_URL}`);
        console.error('   3. Click "Save"\n');
        return false;
      }

      // Other errors (like email not found) are OK - means redirect URL is valid
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        console.log('✅ REDIRECT URL IS CONFIGURED');
        console.log(`\n   Note: ${error.message}`);
        console.log('   (This is expected - the test email doesn\'t exist, but redirect URL validation passed)\n');
        return true;
      }

      // Provider not enabled error
      if (error.message.includes('provider is not enabled')) {
        console.error('❌ EMAIL PROVIDER NOT ENABLED');
        console.error(`\n   Error: ${error.message}\n`);
        console.error('   To fix this:');
        console.error('   1. Go to: https://supabase.com/dashboard/project/ysyiyzdtftctvdk/auth/providers');
        console.error('   2. Enable the "Email" provider');
        console.error('   3. Click "Save"\n');
        return false;
      }

      // Unknown error
      console.error('❌ UNEXPECTED ERROR');
      console.error(`\n   Error: ${error.message}\n`);
      return false;
    }

    // Success - redirect URL is valid
    console.log('✅ REDIRECT URL IS CONFIGURED');
    console.log('\n   Password reset email would be sent successfully!');
    console.log('   (Note: Email may not actually send if the email doesn\'t exist,');
    console.log('    but the redirect URL validation passed)\n');
    return true;
  } catch (err) {
    console.error('❌ UNEXPECTED ERROR');
    console.error(`\n   Error: ${err.message}\n`);
    return false;
  }
}

// Run the test
testPasswordResetRedirect()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
