import { supabase } from '../client';
import { fetchProfileValues } from './profile-values';
import { handleSupabaseError } from '../utils/error-handler';

/**
 * Verification helper to check auth status and saved data
 * Call this from the console or a debug screen to verify everything is working
 */
export async function verifyAuthAndData() {
  console.log('🔍 Verifying Auth and Data...\n');

  // Check session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('❌ Session Error:', sessionError);
    return { success: false, error: sessionError };
  }

  if (!session?.user) {
    console.log('⚠️ No active session - user is not authenticated');
    return { success: false, authenticated: false };
  }

  const user = session.user;
  console.log('✅ Authentication Status:');
  console.log('   User ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Created:', user.created_at);
  console.log('   Email Confirmed:', user.email_confirmed_at ? 'Yes' : 'No\n');

  // Check profile record
  console.log('📋 Checking Profile Record...');
  try {
    const { data: profile, error: profileError } = await supabase
      .schema('tm')
      .from('profiles')
      .select('user_id, created_at')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      const error = handleSupabaseError(profileError);
      console.log('⚠️ Profile record:', profileError.code === 'PGRST116' ? 'Not found' : error.message);
    } else {
      console.log('✅ Profile record exists');
      console.log('   User ID:', profile.user_id);
      console.log('   Created:', profile.created_at);
    }
  } catch (error) {
    console.error('❌ Error checking profile:', error);
  }

  // Check profile values
  console.log('\n📊 Checking Profile Values...');
  try {
    const { data: valuesData, error: valuesError } = await supabase
      .schema('tm')
      .from('profile_values')
      .select('id, value_label, rank, created_at')
      .eq('user_id', user.id)
      .order('rank', { ascending: true });

    if (valuesError) {
      const error = handleSupabaseError(valuesError);
      console.error('❌ Error fetching profile values:', error.message);
    } else {
      const values = valuesData || [];
      console.log('✅ Profile Values Found in Supabase:', values.length);
      if (values.length > 0) {
        values.forEach((value, index) => {
          console.log(`   ${index + 1}. "${value.value_label}" (rank: ${value.rank}, id: ${value.id})`);
        });
      } else {
        console.log('   (No values saved yet)');
      }
    }
  } catch (error) {
    console.error('❌ Error fetching profile values:', error);
  }

  console.log('\n✅ Verification Complete');
  return {
    success: true,
    authenticated: true,
    userId: user.id,
    email: user.email,
  };
}

// Make it available globally for easy console access
if (typeof window !== 'undefined') {
  (window as any).verifyAuth = verifyAuthAndData;
}
