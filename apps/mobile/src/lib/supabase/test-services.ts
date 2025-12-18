/**
 * Test script to verify all Supabase services are working
 * Run this in the app console or as a test
 * 
 * Usage:
 *   import { testSupabaseServices } from '@/lib/supabase/test-services';
 *   testSupabaseServices();
 */

import { useAuthStore } from '@/stores';
import {
  fetchProfile,
  updateProfile,
  updateFullName,
  updateDailyRhythm,
  updateMission,
  dateToTimeString,
} from './services/profiles';
import {
  fetchGoals,
  fetchInitiatives,
  createGoal,
  createInitiative,
  bulkCreateGoals,
  bulkCreateInitiatives,
} from './services/events';
import { fetchProfileValues, saveProfileValues } from './services/profile-values';

export async function testSupabaseServices() {
  console.log('🧪 Testing Supabase Services...\n');

  const user = useAuthStore.getState().user;
  const isAuthenticated = useAuthStore.getState().isAuthenticated;

  if (!isAuthenticated || !user?.id) {
    console.error('❌ User not authenticated. Please sign in first.');
    return { success: false, error: 'Not authenticated' };
  }

  const userId = user.id;
  const results: Record<string, { success: boolean; error?: string; data?: any }> = {};

  // Test 1: Profile - Fetch
  console.log('1️⃣ Testing Profile Fetch...');
  try {
    const profile = await fetchProfile(userId);
    results.profileFetch = { success: true, data: profile };
    console.log('✅ Profile fetch:', profile ? 'Found' : 'Not found (will be created)');
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    results.profileFetch = { success: false, error: err.message };
    console.error('❌ Profile fetch failed:', err.message);
  }

  // Test 2: Profile - Update
  console.log('\n2️⃣ Testing Profile Update...');
  try {
    await updateFullName(userId, 'Test User');
    results.profileUpdate = { success: true };
    console.log('✅ Profile update: Success');
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    results.profileUpdate = { success: false, error: err.message };
    console.error('❌ Profile update failed:', err.message);
  }

  // Test 3: Profile Values - Fetch
  console.log('\n3️⃣ Testing Profile Values Fetch...');
  try {
    const values = await fetchProfileValues(userId);
    results.profileValuesFetch = { success: true, data: values };
    console.log('✅ Profile values fetch:', values.length, 'values');
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    results.profileValuesFetch = { success: false, error: err.message };
    console.error('❌ Profile values fetch failed:', err.message);
  }

  // Test 4: Profile Values - Save
  console.log('\n4️⃣ Testing Profile Values Save...');
  try {
    await saveProfileValues(userId, ['Test Value 1', 'Test Value 2']);
    results.profileValuesSave = { success: true };
    console.log('✅ Profile values save: Success');
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    results.profileValuesSave = { success: false, error: err.message };
    console.error('❌ Profile values save failed:', err.message);
  }

  // Test 5: Goals - Fetch
  console.log('\n5️⃣ Testing Goals Fetch...');
  try {
    const goals = await fetchGoals(userId);
    results.goalsFetch = { success: true, data: goals };
    console.log('✅ Goals fetch:', goals.length, 'goals');
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    results.goalsFetch = { success: false, error: err.message };
    console.error('❌ Goals fetch failed:', err.message);
  }

  // Test 6: Goals - Create
  console.log('\n6️⃣ Testing Goal Create...');
  try {
    const goal = await createGoal(userId, 'Test Goal', {
      color: '#2563EB',
      progress: 0,
    });
    results.goalCreate = { success: true, data: goal };
    console.log('✅ Goal create: Success', goal.id);
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    results.goalCreate = { success: false, error: err.message };
    console.error('❌ Goal create failed:', err.message);
  }

  // Test 7: Initiatives - Fetch
  console.log('\n7️⃣ Testing Initiatives Fetch...');
  try {
    const initiatives = await fetchInitiatives(userId);
    results.initiativesFetch = { success: true, data: initiatives };
    console.log('✅ Initiatives fetch:', initiatives.length, 'initiatives');
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    results.initiativesFetch = { success: false, error: err.message };
    console.error('❌ Initiatives fetch failed:', err.message);
  }

  // Test 8: Initiatives - Create
  console.log('\n8️⃣ Testing Initiative Create...');
  try {
    const initiative = await createInitiative(userId, 'Test Initiative', 'Test description');
    results.initiativeCreate = { success: true, data: initiative };
    console.log('✅ Initiative create: Success', initiative.id);
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    results.initiativeCreate = { success: false, error: err.message };
    console.error('❌ Initiative create failed:', err.message);
  }

  // Summary
  console.log('\n📊 Test Summary:');
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter((r) => r.success).length;
  const failed = total - passed;

  console.log(`   Total: ${total}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    Object.entries(results).forEach(([test, result]) => {
      if (!result.success) {
        console.log(`   - ${test}: ${result.error}`);
      }
    });
  }

  return {
    success: failed === 0,
    results,
    summary: { total, passed, failed },
  };
}

// Make it available globally for easy console access
if (typeof window !== 'undefined') {
  (window as any).testSupabaseServices = testSupabaseServices;
}
