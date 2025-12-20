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

/**
 * Parse and enhance Supabase errors with helpful messages
 */
export function handleSupabaseError(error: any): Error {
  if (!error) {
    return new Error('Unknown error occurred');
  }

  // Extract error details
  const code = error.code || 'UNKNOWN';
  const message = error.message || 'An error occurred';
  const details = error.details || '';
  const hint = error.hint || '';

  // Schema permission errors
  if (code === '42501') {
    return new Error(
      `Schema access denied: The 'tm' schema is not exposed in Supabase API settings. ` +
      `Please ask your team to add 'tm' to the "Exposed schemas" list in Dashboard → Settings → API.`
    );
  }

  // Table not found errors
  if (code === 'PGRST205') {
    const tableMatch = message.match(/table ['"]([^'"]+)['"]/);
    const tableName = tableMatch ? tableMatch[1] : 'table';
    
    return new Error(
      `Table not found: ${tableName} doesn't exist in the schema cache. ` +
      `This could mean:\n` +
      `1. The table hasn't been created yet\n` +
      `2. The schema cache needs to be refreshed (run: NOTIFY pgrst, 'reload schema';)\n` +
      `3. The table exists in a different schema`
    );
  }

  // Foreign key constraint errors
  if (code === '23503') {
    return new Error(
      `Foreign key constraint failed: ${message}. ` +
      `Make sure the referenced record exists before creating this one.`
    );
  }

  // Unique constraint errors
  if (code === '23505') {
    return new Error(
      `Duplicate entry: ${message}. ` +
      `This record already exists and cannot be duplicated.`
    );
  }

  // Not found errors
  if (code === 'PGRST116') {
    return new Error(`Record not found: ${message}`);
  }

  // Column doesn't exist errors
  if (code === '42703') {
    const columnMatch = message.match(/column ["']?([^"']+)["']? does not exist/i);
    const columnName = columnMatch ? columnMatch[1] : 'column';
    return new Error(
      `Column not found: ${columnName} doesn't exist in the table. ` +
      `This might mean the table structure is different than expected. ` +
      `Please check the actual schema structure in Supabase.`
    );
  }

  // Network/connection errors
  if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
    return new Error(
      `Network error: Unable to connect to Supabase. ` +
      `Please check your internet connection and try again.`
    );
  }

  // Authentication errors
  if (code === 'PGRST301' || message.includes('JWT') || message.includes('token')) {
    return new Error(
      `Authentication error: Your session has expired. Please sign in again.`
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

  const enhancedError = new Error(enhancedMessage);
  (enhancedError as any).code = code;
  (enhancedError as any).details = details;
  (enhancedError as any).hint = hint;

  return enhancedError;
}

/**
 * Check if error is a schema/table access issue
 */
export function isSchemaAccessError(error: any): boolean {
  const code = error?.code;
  return code === '42501' || code === 'PGRST205';
}

/**
 * Check if error is a network/connection issue
 */
export function isNetworkError(error: any): boolean {
  const message = error?.message || '';
  return message.includes('fetch') || 
         message.includes('network') || 
         message.includes('Failed to fetch');
}

/**
 * Check if error is an authentication issue
 */
export function isAuthError(error: any): boolean {
  const code = error?.code;
  const message = error?.message || '';
  return code === 'PGRST301' || 
         message.includes('JWT') || 
         message.includes('token') ||
         message.includes('unauthorized');
}




