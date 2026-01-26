import type { Database } from '../database.types';
import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';

// ---------------------------------------------------------------------------
// Types derived from database schema
// ---------------------------------------------------------------------------

type ActivityCategoriesTable = Database['tm']['Tables']['activity_categories'];

/** A row as returned from Supabase select */
export type ActivityCategory = ActivityCategoriesTable['Row'];

/** Payload for inserting a new category */
export type ActivityCategoryInsert = ActivityCategoriesTable['Insert'];

/** Payload for updating an existing category */
export type ActivityCategoryUpdate = ActivityCategoriesTable['Update'];

/** A category node with nested children for tree display */
export interface ActivityCategoryNode extends ActivityCategory {
  children: ActivityCategoryNode[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema('tm');
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Fetch all activity categories for a user (flat list). */
export async function fetchActivityCategories(
  userId: string
): Promise<ActivityCategory[]> {
  const { data, error } = await tmSchema()
    .from('activity_categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) throw handleSupabaseError(error);
  return (data ?? []) as ActivityCategory[];
}

/** Fetch only top-level categories (parent_id is null). */
export async function fetchTopLevelCategories(
  userId: string
): Promise<ActivityCategory[]> {
  const { data, error } = await tmSchema()
    .from('activity_categories')
    .select('*')
    .eq('user_id', userId)
    .is('parent_id', null)
    .order('sort_order', { ascending: true });

  if (error) throw handleSupabaseError(error);
  return (data ?? []) as ActivityCategory[];
}

/** Fetch direct children of a given parent category. */
export async function fetchSubcategories(
  userId: string,
  parentId: string
): Promise<ActivityCategory[]> {
  const { data, error } = await tmSchema()
    .from('activity_categories')
    .select('*')
    .eq('user_id', userId)
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: true });

  if (error) throw handleSupabaseError(error);
  return (data ?? []) as ActivityCategory[];
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/** Create a new activity category. */
export async function createActivityCategory(
  input: ActivityCategoryInsert
): Promise<ActivityCategory> {
  const { data, error } = await tmSchema()
    .from('activity_categories')
    .insert(input)
    .select('*')
    .single();

  if (error) throw handleSupabaseError(error);
  return data as ActivityCategory;
}

/** Update an existing activity category. */
export async function updateActivityCategory(
  categoryId: string,
  updates: ActivityCategoryUpdate
): Promise<ActivityCategory> {
  const { data, error } = await tmSchema()
    .from('activity_categories')
    .update(updates)
    .eq('id', categoryId)
    .select('*')
    .single();

  if (error) throw handleSupabaseError(error);
  return data as ActivityCategory;
}

/**
 * Delete an activity category.
 * Blocks deletion if the category has children — caller must delete or
 * re-parent children first.
 */
export async function deleteActivityCategory(
  categoryId: string
): Promise<void> {
  // Check for children before deleting
  const { data: children, error: childError } = await tmSchema()
    .from('activity_categories')
    .select('id')
    .eq('parent_id', categoryId)
    .limit(1);

  if (childError) throw handleSupabaseError(childError);

  if (children && children.length > 0) {
    throw new Error(
      'Cannot delete a category that has subcategories. Remove or move subcategories first.'
    );
  }

  const { error } = await tmSchema()
    .from('activity_categories')
    .delete()
    .eq('id', categoryId);

  if (error) throw handleSupabaseError(error);
}

// ---------------------------------------------------------------------------
// Tree builder
// ---------------------------------------------------------------------------

/**
 * Build a nested tree from a flat list of categories.
 * Top-level categories (parent_id === null) become root nodes.
 * Each node's `children` array contains its direct subcategories, recursively.
 */
export function buildCategoryTree(
  categories: ActivityCategory[]
): ActivityCategoryNode[] {
  const nodeMap = new Map<string, ActivityCategoryNode>();

  // Create nodes
  for (const cat of categories) {
    nodeMap.set(cat.id, { ...cat, children: [] });
  }

  const roots: ActivityCategoryNode[] = [];

  // Link children to parents
  for (const cat of categories) {
    const node = nodeMap.get(cat.id)!;
    if (cat.parent_id === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(cat.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphan — treat as root (shouldn't happen with FK constraints)
        roots.push(node);
      }
    }
  }

  return roots;
}
