/**
 * Comprehensive test suite for all Supabase integrations
 * Tests all services, hooks, and data flows
 * 
 * Usage:
 *   import { testAllIntegrations } from '@/lib/supabase/test-all-integrations';
 *   await testAllIntegrations();
 */

import { useAuthStore } from '@/stores';
import {
  // Profile services
  fetchProfile,
  updateProfile,
  updateFullName,
  updateDailyRhythm,
  updateMission,
  updateRole,
  updateJoySelections,
  updateDrainSelections,
  updateFocusStyle,
  updateCoachPersona,
  updateMorningMindset,
  updateProfilePreferences,
  getProfilePreferences,
  dateToTimeString,
  timeStringToDate,
} from './services/profiles';
import {
  // Events services
  fetchGoals,
  fetchInitiatives,
  createGoal,
  createInitiative,
  updateEvent,
  deleteEvent,
  bulkCreateGoals,
  bulkCreateInitiatives,
} from './services/events';
import {
  // Profile values services
  fetchProfileValues,
  saveProfileValues,
  addProfileValue,
  removeProfileValue,
} from './services/profile-values';
import { handleSupabaseError, isSchemaAccessError, isNetworkError, isAuthError } from './utils/error-handler';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  data?: unknown;
  duration?: number;
}

export async function testAllIntegrations(): Promise<{
  success: boolean;
  results: TestResult[];
  summary: { total: number; passed: number; failed: number };
}> {
  console.log('🧪 Testing All Supabase Integrations...\n');
  console.log('=' .repeat(60));

  const user = useAuthStore.getState().user;
  const isAuthenticated = useAuthStore.getState().isAuthenticated;

  if (!isAuthenticated || !user?.id) {
    console.error('❌ User not authenticated. Please sign in first.');
    return {
      success: false,
      results: [{ name: 'Authentication', success: false, error: 'Not authenticated' }],
      summary: { total: 1, passed: 0, failed: 1 },
    };
  }

  const userId = user.id;
  const results: TestResult[] = [];

  // Helper to run test
  const runTest = async (name: string, testFn: () => Promise<unknown>): Promise<void> => {
    const start = Date.now();
    try {
      const data = await testFn();
      const duration = Date.now() - start;
      results.push({ name, success: true, data, duration });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      const err = error instanceof Error ? error : new Error('Unknown error');
      results.push({ name, success: false, error: err.message, duration });
      console.error(`❌ ${name}: ${err.message}`);
    }
  };

  // ============================================================================
  // TEST GROUP 1: Profile Services
  // ============================================================================
  console.log('\n📋 TEST GROUP 1: Profile Services\n');

  await runTest('1.1 Fetch Profile', async () => {
    return await fetchProfile(userId);
  });

  await runTest('1.2 Update Full Name', async () => {
    await updateFullName(userId, 'Test User ' + Date.now());
    return { updated: true };
  });

  await runTest('1.3 Update Daily Rhythm', async () => {
    await updateDailyRhythm(userId, '06:30', '22:30');
    return { updated: true };
  });

  await runTest('1.4 Update Mission', async () => {
    await updateMission(userId, 'balance');
    return { updated: true };
  });

  await runTest('1.5 Update Joy Selections', async () => {
    await updateJoySelections(userId, ['Reading', 'Exercise', 'Music']);
    return { updated: true };
  });

  await runTest('1.6 Update Drain Selections', async () => {
    await updateDrainSelections(userId, ['Long meetings', 'Traffic']);
    return { updated: true };
  });

  await runTest('1.7 Update Focus Style', async () => {
    await updateFocusStyle(userId, 'flow');
    return { updated: true };
  });

  await runTest('1.8 Update Coach Persona', async () => {
    await updateCoachPersona(userId, 'strategist');
    return { updated: true };
  });

  await runTest('1.9 Update Morning Mindset', async () => {
    await updateMorningMindset(userId, 'slow');
    return { updated: true };
  });

  await runTest('1.10 Update Profile Preferences (Bulk)', async () => {
    await updateProfilePreferences(userId, {
      joy_selections: ['Reading', 'Exercise'],
      drain_selections: ['Long meetings'],
      focus_style: 'flow',
      coach_persona: 'strategist',
      morning_mindset: 'slow',
    });
    return { updated: true };
  });

  await runTest('1.11 Get Profile Preferences', async () => {
    const profile = await fetchProfile(userId);
    return getProfilePreferences(profile);
  });

  await runTest('1.12 Date/Time Helpers', async () => {
    const date = new Date();
    date.setHours(6, 30, 0, 0);
    const timeStr = dateToTimeString(date);
    const backToDate = timeStringToDate(timeStr);
    return { timeStr, hours: backToDate.getHours(), minutes: backToDate.getMinutes() };
  });

  // ============================================================================
  // TEST GROUP 2: Profile Values Services
  // ============================================================================
  console.log('\n📊 TEST GROUP 2: Profile Values Services\n');

  await runTest('2.1 Fetch Profile Values', async () => {
    return await fetchProfileValues(userId);
  });

  await runTest('2.2 Save Profile Values', async () => {
    await saveProfileValues(userId, ['Test Value 1', 'Test Value 2', 'Test Value 3']);
    return { saved: true };
  });

  await runTest('2.3 Add Profile Value', async () => {
    await addProfileValue(userId, 'Test Value Added');
    return { added: true };
  });

  await runTest('2.4 Remove Profile Value', async () => {
    await removeProfileValue(userId, 'Test Value Added');
    return { removed: true };
  });

  // ============================================================================
  // TEST GROUP 3: Events Services (Goals & Initiatives)
  // ============================================================================
  console.log('\n🎯 TEST GROUP 3: Events Services (Goals & Initiatives)\n');

  await runTest('3.1 Fetch Goals', async () => {
    return await fetchGoals(userId);
  });

  await runTest('3.2 Fetch Initiatives', async () => {
    return await fetchInitiatives(userId);
  });

  await runTest('3.3 Create Goal', async () => {
    const goal = await createGoal(userId, 'Test Goal ' + Date.now(), {
      color: '#2563EB',
      progress: 0.5,
    });
    return goal;
  });

  await runTest('3.4 Create Initiative', async () => {
    const initiative = await createInitiative(userId, 'Test Initiative ' + Date.now(), 'Test description');
    return initiative;
  });

  await runTest('3.5 Bulk Create Goals', async () => {
    const goals = await bulkCreateGoals(userId, ['Bulk Goal 1', 'Bulk Goal 2']);
    return goals;
  });

  await runTest('3.6 Bulk Create Initiatives', async () => {
    const initiatives = await bulkCreateInitiatives(userId, ['Bulk Initiative 1', 'Bulk Initiative 2']);
    return initiatives;
  });

  // ============================================================================
  // TEST GROUP 4: Error Handling
  // ============================================================================
  console.log('\n⚠️ TEST GROUP 4: Error Handling\n');

  await runTest('4.1 Schema Access Error Detection', async () => {
    const error = { code: '42501', message: 'permission denied' };
    return {
      isSchemaError: isSchemaAccessError(error),
      handled: handleSupabaseError(error).message,
    };
  });

  await runTest('4.2 Network Error Detection', async () => {
    const error = { message: 'Failed to fetch' };
    return {
      isNetworkError: isNetworkError(error),
      handled: handleSupabaseError(error).message,
    };
  });

  await runTest('4.3 Auth Error Detection', async () => {
    const error = { code: 'PGRST301', message: 'JWT expired' };
    return {
      isAuthError: isAuthError(error),
      handled: handleSupabaseError(error).message,
    };
  });

  // ============================================================================
  // TEST GROUP 5: Integration (Full Flow)
  // ============================================================================
  console.log('\n🔄 TEST GROUP 5: Integration (Full Flow)\n');

  await runTest('5.1 Complete Profile Update Flow', async () => {
    // Update all profile fields
    await updateFullName(userId, 'Integration Test User');
    await updateDailyRhythm(userId, '07:00', '23:00');
    await updateMission(userId, 'clarity');
    await updateProfilePreferences(userId, {
      joy_selections: ['Reading', 'Exercise'],
      drain_selections: ['Traffic'],
      focus_style: 'deep',
      coach_persona: 'cheerleader',
      morning_mindset: 'energy',
    });
    
    // Fetch and verify
    const profile = await fetchProfile(userId);
    return {
      name: profile?.full_name,
      wakeTime: profile?.ideal_work_day,
      sleepTime: profile?.ideal_sabbath,
      mission: profile?.mission,
      preferences: getProfilePreferences(profile),
    };
  });

  await runTest('5.2 Complete Goals/Initiatives Flow', async () => {
    // Create goals and initiatives
    const goal1 = await createGoal(userId, 'Integration Goal 1');
    const goal2 = await createGoal(userId, 'Integration Goal 2');
    const initiative1 = await createInitiative(userId, 'Integration Initiative 1');
    
    // Fetch and verify
    const goals = await fetchGoals(userId);
    const initiatives = await fetchInitiatives(userId);
    
    return {
      created: { goal1: goal1.id, goal2: goal2.id, initiative1: initiative1.id },
      fetched: { goals: goals.length, initiatives: initiatives.length },
    };
  });

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:\n');

  const total = results.length;
  const passed = results.filter((r) => r.success).length;
  const failed = total - passed;

  console.log(`   Total Tests: ${total}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
  }

  // Group results by category
  const profileTests = results.filter((r) => r.name.startsWith('1.'));
  const valuesTests = results.filter((r) => r.name.startsWith('2.'));
  const eventsTests = results.filter((r) => r.name.startsWith('3.'));
  const errorTests = results.filter((r) => r.name.startsWith('4.'));
  const integrationTests = results.filter((r) => r.name.startsWith('5.'));

  console.log('\n📋 Results by Category:');
  console.log(`   Profile Services: ${profileTests.filter((r) => r.success).length}/${profileTests.length}`);
  console.log(`   Profile Values: ${valuesTests.filter((r) => r.success).length}/${valuesTests.length}`);
  console.log(`   Events: ${eventsTests.filter((r) => r.success).length}/${eventsTests.length}`);
  console.log(`   Error Handling: ${errorTests.filter((r) => r.success).length}/${errorTests.length}`);
  console.log(`   Integration: ${integrationTests.filter((r) => r.success).length}/${integrationTests.length}`);

  return {
    success: failed === 0,
    results,
    summary: { total, passed, failed },
  };
}

// Make it available globally for easy console access
if (typeof window !== 'undefined') {
  window.testAllIntegrations = testAllIntegrations;
}

declare global {
  interface Window {
    testAllIntegrations?: typeof testAllIntegrations;
  }
}

export {};





