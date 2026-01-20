-- =============================================================================
-- Sleep stage metrics + wake windows
-- =============================================================================

alter table tm.health_daily_metrics
  add column if not exists sleep_in_bed_seconds integer null,
  add column if not exists sleep_awake_seconds integer null,
  add column if not exists sleep_deep_seconds integer null,
  add column if not exists sleep_rem_seconds integer null,
  add column if not exists sleep_light_seconds integer null;
