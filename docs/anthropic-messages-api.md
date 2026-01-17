# Anthropic Messages API (Edge Functions)

Use the Anthropic Messages API for classification in Supabase Edge Functions.

## References

- https://docs.anthropic.com/en/api/messages
- https://docs.anthropic.com/en/api/headers

## Notes

- Deno edge functions should call the REST API directly with `fetch`.
- Required headers: `x-api-key`, `anthropic-version`, `content-type`.
- Provide a `system` prompt plus `messages` with a `user` role.
