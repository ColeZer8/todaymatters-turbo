/**
 * Emergency script to fix Paul's duplicate meeting events
 * Run with: npx ts-node scripts/fix-paul-duplicates.ts
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment or hardcode temporarily
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  // Get Paul's user_id from command line or use hardcoded value
  const paulUserId = process.argv[2] || '79a6e69a-e07e-4e67-a069-50f6b74a8c13';
  
  console.log(`🔍 Working with user: ${paulUserId}\n`);
  
  // Verify user exists by checking if they have any events
  const { count: eventCount, error: checkError } = await supabase
    .schema('tm')
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', paulUserId)
    .limit(1);
  
  if (checkError) {
    console.error('❌ Error accessing tm.events:', checkError.message);
    console.log('\nℹ️  Make sure you have the correct Supabase URL and key in apps/mobile/.env\n');
    return;
  }
  
  if (eventCount === 0) {
    console.error('❌ No events found for this user. Check the user_id.');
    console.log(`\n💡 Usage: ./fix-paul.sh <user_id>\n`);
    return;
  }
  
  console.log(`✅ Found user with events\n`);

  // Step 2: Count events
  console.log('📊 Counting events...\n');

  const { data: eventCounts, error: countError } = await supabase
    .schema('tm')
    .from('events')
    .select('type, title')
    .eq('user_id', paulUserId)
    .gte('local_date', '2026-02-01');

  if (countError) {
    console.error('Error counting events:', countError);
    return;
  }

  // Group by title
  const titleCounts = new Map<string, number>();
  for (const event of eventCounts || []) {
    const count = titleCounts.get(event.title) || 0;
    titleCounts.set(event.title, count + 1);
  }

  console.log('Event counts by title:');
  const sorted = Array.from(titleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [title, count] of sorted) {
    console.log(`  ${title}: ${count}`);
  }

  const totalEvents = eventCounts?.length || 0;
  console.log(`\n📈 Total events: ${totalEvents}\n`);

  // Step 3: Find duplicates
  console.log('🔍 Looking for duplicates...\n');

  const { data: allEvents, error: allError } = await supabase
    .schema('tm')
    .from('events')
    .select('id, title, local_date, scheduled_start_iso, scheduled_end_iso, created_at')
    .eq('user_id', paulUserId)
    .or('title.ilike.%Meeting%,title.ilike.%Private Event%')
    .gte('local_date', '2026-02-01')
    .order('created_at', { ascending: true });

  if (allError) {
    console.error('Error fetching events:', allError);
    return;
  }

  // Group by unique key
  const groups = new Map<string, any[]>();
  for (const event of allEvents || []) {
    const key = `${event.local_date}|${event.scheduled_start_iso}|${event.scheduled_end_iso}|${event.title}`;
    const existing = groups.get(key) || [];
    existing.push(event);
    groups.set(key, existing);
  }

  // Find duplicates
  const duplicateGroups = Array.from(groups.values()).filter(g => g.length > 1);
  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + (g.length - 1), 0);

  console.log(`Found ${duplicateGroups.length} duplicate groups`);
  console.log(`Total duplicate events to delete: ${totalDuplicates}\n`);

  if (duplicateGroups.length > 0) {
    console.log('Sample duplicates:');
    for (let i = 0; i < Math.min(3, duplicateGroups.length); i++) {
      const group = duplicateGroups[i];
      console.log(`  "${group[0].title}" on ${group[0].local_date}: ${group.length} copies`);
    }
    console.log();
  }

  // Step 4: Delete duplicates
  console.log('⚠️  Ready to delete duplicates?\n');
  console.log('This will keep the oldest event in each duplicate group and delete the rest.\n');

  const shouldDelete = process.argv.includes('--delete');

  if (!shouldDelete) {
    console.log('❌ DRY RUN MODE - No deletions performed');
    console.log('   Run with --delete flag to actually delete duplicates\n');
    console.log(`💡 Command: npx ts-node scripts/fix-paul-duplicates.ts --delete\n`);
    return;
  }

  console.log('🗑️  Deleting duplicates...\n');

  let deletedCount = 0;
  for (const group of duplicateGroups) {
    // Keep the first (oldest) event, delete the rest
    const toDelete = group.slice(1).map(e => e.id);

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .schema('tm')
        .from('events')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        console.error(`Error deleting group:`, deleteError);
      } else {
        deletedCount += toDelete.length;
      }
    }
  }

  console.log(`✅ Deleted ${deletedCount} duplicate events\n`);

  // Step 5: Verify
  console.log('✅ Verifying fix...\n');

  const { data: afterCounts, error: afterError } = await supabase
    .schema('tm')
    .from('events')
    .select('title')
    .eq('user_id', paulUserId)
    .gte('local_date', '2026-02-01');

  if (!afterError && afterCounts) {
    const afterTitleCounts = new Map<string, number>();
    for (const event of afterCounts) {
      const count = afterTitleCounts.get(event.title) || 0;
      afterTitleCounts.set(event.title, count + 1);
    }

    console.log('Event counts after cleanup:');
    const afterSorted = Array.from(afterTitleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [title, count] of afterSorted) {
      console.log(`  ${title}: ${count}`);
    }

    console.log(`\n📉 Total events: ${afterCounts.length} (was ${totalEvents})\n`);
    console.log(`🎉 Removed ${totalEvents - afterCounts.length} total events\n`);
  }

  console.log('✅ Done!\n');
}

main().catch(console.error);
