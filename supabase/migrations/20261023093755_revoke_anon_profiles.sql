/*
# Revoke anon access on profiles table

The profiles table should only be accessible to authenticated users (the app
requires sign-in). The initial migration granted to `authenticated` and
`service_role`, but Supabase's defaults also gave `anon` full access. This
migration explicitly revokes all privileges from `anon` so unauthenticated
requests cannot read or modify profile data.
*/

REVOKE ALL ON profiles FROM anon;