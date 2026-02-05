-- Allow authenticated users to delete their own screen time app rows (used by replace sync).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_daily' and policyname='tm.screen_time_app_daily: delete own'
  ) then
    execute $$create policy "tm.screen_time_app_daily: delete own"
      on tm.screen_time_app_daily for delete using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_hourly' and policyname='tm.screen_time_app_hourly: delete own'
  ) then
    execute $$create policy "tm.screen_time_app_hourly: delete own"
      on tm.screen_time_app_hourly for delete using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_sessions' and policyname='tm.screen_time_app_sessions: delete own'
  ) then
    execute $$create policy "tm.screen_time_app_sessions: delete own"
      on tm.screen_time_app_sessions for delete using (auth.uid() = user_id)$$;
  end if;
end $$;
