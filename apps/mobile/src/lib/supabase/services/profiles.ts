import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';

/**
 * Profile preferences stored in meta JSONB
 */
export interface ProfilePreferences {
  joy_selections?: string[];
  drain_selections?: string[];
  focus_style?: string | null;
  coach_persona?: string | null;
  morning_mindset?: string | null;
}

/**
 * Profile data structure matching tm.profiles table
 * Note: The actual tm.profiles table may not have an 'id' column
 */
export interface ProfileData {
  id?: string; // May not exist in tm.profiles
  user_id: string;
  full_name?: string | null;
  ideal_work_day?: string | null; // Wake time as "HH:MM" format
  ideal_sabbath?: string | null; // Sleep time as "HH:MM" format
  mission?: string | null; // Purpose/Why selection
  role?: string | null; // Setup questions role (needs column in DB)
  timezone?: string | null;
  meta?: ProfilePreferences | Record<string, any> | null; // JSONB for preferences
  created_at?: string;
  updated_at?: string;
}

/**
 * Ensure a profile record exists for the user in tm schema
 * Creates one if it doesn't exist, otherwise returns existing
 * 
 * Note: Using tm schema - profiles table must exist in tm schema
 */
export async function ensureProfileExists(userId: string): Promise<void> {
  try {
    // Check if profile exists in profiles table
    // Note: Don't select 'id' - it may not exist in tm.profiles table
    const { data: existing, error: checkError } = await supabase
      .schema('tm')
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    // Profile exists, we're done
    if (existing && !checkError) {
      console.log('✅ Profile already exists for user:', userId);
      return;
    }

    // If error is not "not found", something else went wrong
    if (checkError && checkError.code !== 'PGRST116') {
      // If column doesn't exist (42703), the table structure might be different
      // Try a simpler check - just see if we can query the table at all
      if (checkError.code === '42703') {
        console.log('⚠️ Column structure issue - assuming profile might exist, attempting to create/update');
        // Continue to try creating - if it already exists, the insert will fail with a unique constraint
        // which we can handle gracefully
      } else {
        console.error('❌ Error checking profile:', checkError);
        throw handleSupabaseError(checkError);
      }
    }

    // Profile doesn't exist, create it
    console.log('➕ Creating profile for user:', userId);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    
    // Create in profiles table
    const { error: insertError } = await supabase
      .schema('tm')
      .from('profiles')
      .insert({
        user_id: userId,
        timezone,
      });

    if (insertError) {
      // If unique constraint violation, profile already exists (that's okay)
      if (insertError.code === '23505') {
        console.log('✅ Profile already exists (unique constraint)');
        return;
      }
      console.error('❌ Error creating profile:', insertError);
      throw handleSupabaseError(insertError);
    }

    console.log('✅ Profile created successfully');
  } catch (error) {
    console.error('❌ Failed to ensure profile exists:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch full profile for a user
 */
export async function fetchProfile(userId: string): Promise<ProfileData | null> {
  try {
    console.log('📥 Fetching profile for user:', userId);
    const { data, error } = await supabase
      .schema('tm')
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile doesn't exist yet - this is okay
        console.log('⚠️ Profile not found for user:', userId);
        return null;
      }
      console.error('❌ Error fetching profile:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Fetched profile:', data?.full_name || '(no name set)');
    return data as ProfileData;
  } catch (error) {
    console.error('❌ Failed to fetch profile:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Update profile fields (partial update)
 */
export async function updateProfile(
  userId: string,
  updates: Partial<Omit<ProfileData, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<ProfileData> {
  try {
    console.log('💾 Updating profile for user:', userId, 'Updates:', Object.keys(updates));
    
    // Ensure profile exists first
    await ensureProfileExists(userId);

    const { data, error } = await supabase
      .schema('tm')
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating profile:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Profile updated successfully');
    return data as ProfileData;
  } catch (error) {
    console.error('❌ Failed to update profile:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Update full name
 */
export async function updateFullName(userId: string, fullName: string): Promise<void> {
  await updateProfile(userId, { full_name: fullName.trim() || null });
}

/**
 * Update daily rhythm (wake and sleep times)
 * Times should be in "HH:MM" format (e.g., "06:30", "22:30")
 */
export async function updateDailyRhythm(
  userId: string,
  wakeTime: string,
  sleepTime: string
): Promise<void> {
  await updateProfile(userId, {
    ideal_work_day: wakeTime,
    ideal_sabbath: sleepTime,
  });
}

/**
 * Update mission/purpose
 */
export async function updateMission(userId: string, mission: string | null): Promise<void> {
  await updateProfile(userId, { mission: mission?.trim() || null });
}

/**
 * Update role (requires role column in database)
 */
export async function updateRole(userId: string, role: string | null): Promise<void> {
  await updateProfile(userId, { role: role?.trim() || null });
}

/**
 * Convert Date to "HH:MM" format for time fields
 */
export function dateToTimeString(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Convert "HH:MM" format to Date (uses today's date)
 */
export function timeStringToDate(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Update profile preferences (joy, drains, focus style, etc.)
 * Stores in profiles.meta JSONB
 */
export async function updateProfilePreferences(
  userId: string,
  preferences: Partial<ProfilePreferences>
): Promise<ProfileData> {
  try {
    console.log('💾 Updating profile preferences for user:', userId, 'Preferences:', Object.keys(preferences));
    
    // Ensure profile exists first
    await ensureProfileExists(userId);

    // Fetch current profile to merge preferences
    const currentProfile = await fetchProfile(userId);
    const currentMeta = (currentProfile?.meta as ProfilePreferences) || {};

    // Merge new preferences with existing
    const updatedMeta: ProfilePreferences = {
      ...currentMeta,
      ...preferences,
    };

    // Update profile with merged meta
    const { data, error } = await supabase
      .schema('tm')
      .from('profiles')
      .update({ meta: updatedMeta })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating profile preferences:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Profile preferences updated successfully');
    return data as ProfileData;
  } catch (error) {
    console.error('❌ Failed to update profile preferences:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Update joy selections
 */
export async function updateJoySelections(userId: string, selections: string[]): Promise<void> {
  await updateProfilePreferences(userId, { joy_selections: selections });
}

/**
 * Update drain selections
 */
export async function updateDrainSelections(userId: string, selections: string[]): Promise<void> {
  await updateProfilePreferences(userId, { drain_selections: selections });
}

/**
 * Update focus style
 */
export async function updateFocusStyle(userId: string, focusStyle: string | null): Promise<void> {
  await updateProfilePreferences(userId, { focus_style: focusStyle });
}

/**
 * Update coach persona
 */
export async function updateCoachPersona(userId: string, coachPersona: string | null): Promise<void> {
  await updateProfilePreferences(userId, { coach_persona: coachPersona });
}

/**
 * Update morning mindset
 */
export async function updateMorningMindset(userId: string, morningMindset: string | null): Promise<void> {
  await updateProfilePreferences(userId, { morning_mindset: morningMindset });
}

/**
 * Get profile preferences from meta
 */
export function getProfilePreferences(profile: ProfileData | null): ProfilePreferences {
  if (!profile?.meta) {
    return {};
  }
  return profile.meta as ProfilePreferences;
}
