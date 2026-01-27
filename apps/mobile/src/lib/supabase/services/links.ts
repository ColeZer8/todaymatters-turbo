import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Database } from "../database.types";

export type LinkObjectType = Database["tm"]["Enums"]["link_object_type"];

export interface LinkRow {
  id: string;
  user_id: string;
  obj1_type: LinkObjectType;
  obj1_id: string;
  obj2_type: LinkObjectType;
  obj2_id: string;
  link_kind: string;
  canonical_key: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLinkInput {
  obj1_type: LinkObjectType;
  obj1_id: string;
  obj2_type: LinkObjectType;
  obj2_id: string;
  link_kind: string;
}

export async function createLink(
  userId: string,
  input: CreateLinkInput,
): Promise<LinkRow> {
  try {
    const { data, error } = await supabase
      .schema("tm")
      .from("links")
      .insert({
        user_id: userId,
        obj1_type: input.obj1_type,
        obj1_id: input.obj1_id,
        obj2_type: input.obj2_type,
        obj2_id: input.obj2_id,
        link_kind: input.link_kind,
        // canonical_key is set by DB trigger
      })
      .select("*")
      .single();

    if (error) throw handleSupabaseError(error);
    return data as LinkRow;
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function deleteLink(
  userId: string,
  linkId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .schema("tm")
      .from("links")
      .delete()
      .eq("user_id", userId)
      .eq("id", linkId);
    if (error) throw handleSupabaseError(error);
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function fetchLinksForObject(
  userId: string,
  objectType: LinkObjectType,
  objectId: string,
  options?: { linkKind?: string },
): Promise<LinkRow[]> {
  try {
    let query = supabase
      .schema("tm")
      .from("links")
      .select("*")
      .eq("user_id", userId)
      .or(
        `and(obj1_type.eq.${objectType},obj1_id.eq.${objectId}),and(obj2_type.eq.${objectType},obj2_id.eq.${objectId})`,
      );

    if (options?.linkKind) {
      query = query.eq("link_kind", options.linkKind);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw handleSupabaseError(error);
    return (data ?? []) as LinkRow[];
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
