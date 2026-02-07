import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Database } from "../database.types";

export type TmEventRow = Database["tm"]["Tables"]["events"]["Row"];

export interface FetchGmailEmailsOptions {
  limit?: number;
  includeRead?: boolean;
  includeArchived?: boolean;
  sinceHours?: number;
}

/**
 * Fetch Gmail email events for the given user.
 *
 * Source of truth:
 * - `tm.events.type = 'email'`
 * - Unread state is derived from `meta.raw.labelIds` (Gmail label IDs)
 */
export async function fetchGmailEmailEvents(
  userId: string,
  options: FetchGmailEmailsOptions = {},
): Promise<TmEventRow[]> {
  const {
    limit = 50,
    includeRead = true,
    includeArchived = false,
    sinceHours,
  } = options;

  try {
    const { data, error } = await supabase
      .schema("tm")
      .from("events")
      .select("id,user_id,type,title,meta,sent_at,received_at,created_at,updated_at")
      .eq("user_id", userId)
      .eq("type", "email")
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw handleSupabaseError(error);
    const rows = (data ?? []) as TmEventRow[];

    let filtered = rows;

    if (!includeArchived) {
      filtered = filtered.filter((row) => isGmailInboxFromMeta(row.meta));
    }

    if (typeof sinceHours === "number" && Number.isFinite(sinceHours)) {
      const cutoff = Date.now() - sinceHours * 60 * 60 * 1000;
      filtered = filtered.filter((row) => {
        // Prefer actual email timestamp over sync time
        const ts = row.sent_at ?? row.received_at ?? row.created_at;
        const time = ts ? new Date(ts).getTime() : NaN;
        return Number.isFinite(time) && time >= cutoff;
      });
    }

    // Unread filter is client-side (labelIds are nested in JSON, and JSON-path filtering can be brittle across PostgREST versions).
    if (!includeRead)
      return filtered.filter((r) => isGmailUnreadFromMeta(r.meta));

    return filtered;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

function isGmailUnreadFromMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  const raw = (meta as Record<string, unknown>).raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const labelIds = (raw as Record<string, unknown>).labelIds;
  if (!Array.isArray(labelIds)) return false;
  return labelIds.some(
    (v) => typeof v === "string" && v.toUpperCase() === "UNREAD",
  );
}

function isGmailInboxFromMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  const raw = (meta as Record<string, unknown>).raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const labelIds = (raw as Record<string, unknown>).labelIds;
  if (!Array.isArray(labelIds)) return true;
  return labelIds.some(
    (v) => typeof v === "string" && v.toUpperCase() === "INBOX",
  );
}
