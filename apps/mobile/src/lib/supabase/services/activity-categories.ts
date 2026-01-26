import type { Database } from '../database.types';

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
