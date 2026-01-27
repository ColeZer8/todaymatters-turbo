/**
 * Enhanced error handling for Supabase queries
 * Provides user-friendly error messages and helps debug schema/table issues
 */

export interface SupabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export class EnhancedSupabaseError extends Error {
  code: string;
  details?: string;
  hint?: string;

  constructor(
    message: string,
    fields: { code: string; details?: string; hint?: string },
  ) {
    super(message);
    this.name = "EnhancedSupabaseError";
    this.code = fields.code;
    this.details = fields.details;
    this.hint = fields.hint;
  }
}

function asSupabaseErrorLike(error: unknown): SupabaseErrorLike | null {
  if (!error || typeof error !== "object") return null;
  return error as SupabaseErrorLike;
}

/**
 * Parse and enhance Supabase errors with helpful messages
 */
export function handleSupabaseError(error: unknown): Error {
  if (!error) {
    return new Error("Unknown error occurred");
  }

  if (error instanceof Error) {
    // Preserve existing Error instances, but still allow enrichment via message parsing below.
    // We'll treat it as an Error-like payload with optional Supabase fields.
  }

  // Extract error details
  const err = asSupabaseErrorLike(error);
  const code = err?.code ?? "UNKNOWN";
  const message =
    err?.message ??
    (error instanceof Error ? error.message : "An error occurred");
  const messageLower = message.toLowerCase();
  const details = err?.details ?? "";
  const hint = err?.hint ?? "";

  // Schema permission errors
  if (code === "42501") {
    return new Error(
      `Schema access denied: The 'tm' schema is not exposed in Supabase API settings. ` +
        `Please ask your team to add 'tm' to the "Exposed schemas" list in Dashboard → Settings → API.`,
    );
  }

  // Table not found errors
  if (code === "PGRST205") {
    const tableMatch = message.match(/table ['"]([^'"]+)['"]/);
    const tableName = tableMatch ? tableMatch[1] : "table";

    return new Error(
      `Table not found: ${tableName} doesn't exist in the schema cache. ` +
        `This could mean:\n` +
        `1. The table hasn't been created yet\n` +
        `2. The schema cache needs to be refreshed (run: NOTIFY pgrst, 'reload schema';)\n` +
        `3. The table exists in a different schema`,
    );
  }

  // Foreign key constraint errors
  if (code === "23503") {
    return new Error(
      `Foreign key constraint failed: ${message}. ` +
        `Make sure the referenced record exists before creating this one.`,
    );
  }

  // Unique constraint errors
  if (code === "23505") {
    return new Error(
      `Duplicate entry: ${message}. ` +
        `This record already exists and cannot be duplicated.`,
    );
  }

  // Not found errors
  if (code === "PGRST116") {
    return new Error(`Record not found: ${message}`);
  }

  // Column doesn't exist errors
  if (code === "42703") {
    const columnMatch = message.match(
      /column ["']?([^"']+)["']? does not exist/i,
    );
    const columnName = columnMatch ? columnMatch[1] : "column";
    return new Error(
      `Column not found: ${columnName} doesn't exist in the table. ` +
        `This might mean the table structure is different than expected. ` +
        `Please check the actual schema structure in Supabase.`,
    );
  }

  // Network/connection errors
  if (
    messageLower.includes("fetch") ||
    messageLower.includes("network") ||
    messageLower.includes("failed to fetch")
  ) {
    return new Error(
      `Network error: Unable to connect to Supabase. ` +
        `Please check your internet connection and try again.`,
    );
  }

  // Authentication errors
  if (
    code === "PGRST301" ||
    message.includes("JWT") ||
    message.includes("token")
  ) {
    return new Error(
      `Authentication error: Your session has expired. Please sign in again.`,
    );
  }

  // Build enhanced error message
  let enhancedMessage = message;
  if (details) {
    enhancedMessage += `\nDetails: ${details}`;
  }
  if (hint) {
    enhancedMessage += `\nHint: ${hint}`;
  }

  return new EnhancedSupabaseError(enhancedMessage, { code, details, hint });
}

/**
 * Check if error is a schema/table access issue
 */
export function isSchemaAccessError(error: unknown): boolean {
  const code = asSupabaseErrorLike(error)?.code;
  return code === "42501" || code === "PGRST205";
}

/**
 * Check if error is a network/connection issue
 */
export function isNetworkError(error: unknown): boolean {
  const message = (asSupabaseErrorLike(error)?.message ?? "").toLowerCase();
  return (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("failed to fetch")
  );
}

/**
 * Check if error is an authentication issue
 */
export function isAuthError(error: unknown): boolean {
  const e = asSupabaseErrorLike(error);
  const code = e?.code;
  const message = e?.message ?? "";
  return (
    code === "PGRST301" ||
    message.includes("JWT") ||
    message.includes("token") ||
    message.includes("unauthorized")
  );
}
