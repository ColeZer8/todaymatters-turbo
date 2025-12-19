import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';

export type IdealDayType = 'weekdays' | 'saturday' | 'sunday' | 'custom';

export interface IdealDayCategoryRow {
  categoryKey: string;
  name: string;
  minutes: number;
  maxMinutes: number;
  color: string | null;
  iconName: string | null;
  position: number;
}

export interface IdealDaySnapshot {
  dayType: IdealDayType;
  templates: Record<Exclude<IdealDayType, 'custom'>, IdealDayCategoryRow[]>;
  overrides: Record<number, IdealDayCategoryRow[]>; // day_of_week => categories
}

async function upsertTemplate(userId: string, dayType: Exclude<IdealDayType, 'custom'>): Promise<string> {
  const { data, error } = await supabase
    .schema('tm')
    .from('ideal_day_templates')
    .upsert({ user_id: userId, day_type: dayType }, { onConflict: 'user_id,day_type' })
    .select('id')
    .single();

  if (error) throw handleSupabaseError(error);
  return data.id as string;
}

async function replaceTemplateCategories(userId: string, templateId: string, categories: IdealDayCategoryRow[]): Promise<void> {
  const { error: deleteError } = await supabase
    .schema('tm')
    .from('ideal_day_categories')
    .delete()
    .eq('user_id', userId)
    .eq('template_id', templateId);
  if (deleteError) throw handleSupabaseError(deleteError);

  if (categories.length === 0) return;

  const rows = categories.map((c) => ({
    template_id: templateId,
    user_id: userId,
    category_key: c.categoryKey,
    name: c.name,
    minutes: Math.max(0, Math.floor(c.minutes)),
    max_minutes: Math.max(0, Math.floor(c.maxMinutes)),
    color: c.color,
    icon_name: c.iconName,
    position: c.position,
  }));

  const { error: insertError } = await supabase.schema('tm').from('ideal_day_categories').insert(rows);
  if (insertError) throw handleSupabaseError(insertError);
}

async function upsertOverride(userId: string, dayOfWeek: number): Promise<string> {
  const { data, error } = await supabase
    .schema('tm')
    .from('ideal_day_overrides')
    .upsert({ user_id: userId, day_of_week: dayOfWeek }, { onConflict: 'user_id,day_of_week' })
    .select('id')
    .single();
  if (error) throw handleSupabaseError(error);
  return data.id as string;
}

async function replaceOverrideCategories(userId: string, overrideId: string, categories: IdealDayCategoryRow[]): Promise<void> {
  const { error: deleteError } = await supabase
    .schema('tm')
    .from('ideal_day_override_categories')
    .delete()
    .eq('user_id', userId)
    .eq('override_id', overrideId);
  if (deleteError) throw handleSupabaseError(deleteError);

  if (categories.length === 0) return;

  const rows = categories.map((c) => ({
    override_id: overrideId,
    user_id: userId,
    category_key: c.categoryKey,
    name: c.name,
    minutes: Math.max(0, Math.floor(c.minutes)),
    max_minutes: Math.max(0, Math.floor(c.maxMinutes)),
    color: c.color,
    icon_name: c.iconName,
    position: c.position,
  }));

  const { error: insertError } = await supabase.schema('tm').from('ideal_day_override_categories').insert(rows);
  if (insertError) throw handleSupabaseError(insertError);
}

export async function fetchIdealDay(userId: string): Promise<IdealDaySnapshot | null> {
  try {
    const { data: templates, error: templatesError } = await supabase
      .schema('tm')
      .from('ideal_day_templates')
      .select('id, day_type')
      .eq('user_id', userId);
    if (templatesError) throw handleSupabaseError(templatesError);

    const templateMap = new Map<string, string>();
    for (const t of templates ?? []) {
      templateMap.set(String(t.day_type), String(t.id));
    }

    const templatesOut: IdealDaySnapshot['templates'] = {
      weekdays: [],
      saturday: [],
      sunday: [],
    };

    for (const dayType of ['weekdays', 'saturday', 'sunday'] as const) {
      const templateId = templateMap.get(dayType);
      if (!templateId) continue;

      const { data: categories, error } = await supabase
        .schema('tm')
        .from('ideal_day_categories')
        .select('category_key, name, minutes, max_minutes, color, icon_name, position')
        .eq('user_id', userId)
        .eq('template_id', templateId)
        .order('position', { ascending: true });
      if (error) throw handleSupabaseError(error);

      templatesOut[dayType] =
        (categories ?? []).map((c) => ({
          categoryKey: String(c.category_key),
          name: String(c.name),
          minutes: Number(c.minutes),
          maxMinutes: Number(c.max_minutes ?? 0),
          color: (c.color as string | null) ?? null,
          iconName: (c.icon_name as string | null) ?? null,
          position: Number(c.position),
        })) ?? [];
    }

    const { data: overrides, error: overridesError } = await supabase
      .schema('tm')
      .from('ideal_day_overrides')
      .select('id, day_of_week')
      .eq('user_id', userId);
    if (overridesError) throw handleSupabaseError(overridesError);

    const overridesOut: IdealDaySnapshot['overrides'] = {};
    for (const o of overrides ?? []) {
      const overrideId = String(o.id);
      const dayOfWeek = Number(o.day_of_week);
      const { data: categories, error } = await supabase
        .schema('tm')
        .from('ideal_day_override_categories')
        .select('category_key, name, minutes, max_minutes, color, icon_name, position')
        .eq('user_id', userId)
        .eq('override_id', overrideId)
        .order('position', { ascending: true });
      if (error) throw handleSupabaseError(error);

      overridesOut[dayOfWeek] =
        (categories ?? []).map((c) => ({
          categoryKey: String(c.category_key),
          name: String(c.name),
          minutes: Number(c.minutes),
          maxMinutes: Number(c.max_minutes ?? 0),
          color: (c.color as string | null) ?? null,
          iconName: (c.icon_name as string | null) ?? null,
          position: Number(c.position),
        })) ?? [];
    }

    const hasAny =
      templatesOut.weekdays.length > 0 ||
      templatesOut.saturday.length > 0 ||
      templatesOut.sunday.length > 0 ||
      Object.keys(overridesOut).length > 0;

    if (!hasAny) return null;

    // UI state (dayType) is stored in profiles.meta; if absent default to weekdays.
    return {
      dayType: 'weekdays',
      templates: templatesOut,
      overrides: overridesOut,
    };
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function saveIdealDay(userId: string, snapshot: IdealDaySnapshot): Promise<void> {
  try {
    // Templates
    for (const dayType of ['weekdays', 'saturday', 'sunday'] as const) {
      const templateId = await upsertTemplate(userId, dayType);
      await replaceTemplateCategories(userId, templateId, snapshot.templates[dayType]);
    }

    // Overrides: delete removed ones, upsert present ones.
    const desiredDays = new Set(Object.keys(snapshot.overrides).map((k) => Number(k)));

    const { data: existing, error: existingError } = await supabase
      .schema('tm')
      .from('ideal_day_overrides')
      .select('id, day_of_week')
      .eq('user_id', userId);
    if (existingError) throw handleSupabaseError(existingError);

    const toDelete = (existing ?? []).filter((row) => !desiredDays.has(Number(row.day_of_week)));
    if (toDelete.length > 0) {
      const ids = toDelete.map((row) => row.id);
      const { error: deleteError } = await supabase.schema('tm').from('ideal_day_overrides').delete().in('id', ids);
      if (deleteError) throw handleSupabaseError(deleteError);
    }

    for (const [dayKey, categories] of Object.entries(snapshot.overrides)) {
      const dayOfWeek = Number(dayKey);
      const overrideId = await upsertOverride(userId, dayOfWeek);
      await replaceOverrideCategories(userId, overrideId, categories);
    }
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

