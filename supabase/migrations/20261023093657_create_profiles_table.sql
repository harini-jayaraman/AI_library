/*
# Create user profiles table

## Purpose
Stores extended profile information for each authenticated user — first name,
last name, and username — so the application can display the user's full name
consistently across all UI sections.  This table complements Supabase Auth's
built-in `auth.users` table (which stores email + password) with the extra
fields collected during sign-up or synchronized from Google OAuth.

## New Table: `profiles`
- `id` (uuid, primary key) — matches `auth.users.id`, one row per auth user.
- `email` (text) — denormalized copy of the auth email for convenience.
- `first_name` (text) — user's first name (from sign-up form or Google profile).
- `last_name` (text) — user's last name (from sign-up form or Google profile).
- `username` (text, unique) — user-chosen display username.
- `created_at` (timestamptz) — row creation timestamp.
- `updated_at` (timestamptz) — auto-updated on modification.

## Security
- RLS enabled: only the owning authenticated user can read/update their own row.
- No `anon` access (app requires sign-in).
- `service_role` granted for edge-function use if needed.
- INSERT policy uses `WITH CHECK (auth.uid() = id)` so the owner is enforced.
- `user_id` is not needed — `id` IS the auth user id (1:1 with auth.users).

## Important Notes
1. Existing auth users who register before this migration will not have a
   profile row yet.  The app handles this by creating one on first login if
   missing (upsert pattern).
2. Google OAuth users get `first_name` / `last_name` extracted from the
   `user_metadata.full_name` field that Supabase populates from Google.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  username text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO service_role;

-- Users can read their own profile
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can insert their own profile row
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can update their own profile row
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();