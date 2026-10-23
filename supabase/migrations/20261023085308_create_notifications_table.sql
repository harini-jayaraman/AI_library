/*
# Create notifications table for per-user library notifications

## Purpose
Stores notifications generated from real application events (due dates,
renewals, reservation blocks, renewal limit reached, hold status changes).
Each notification belongs to a signed-in user and is isolated via RLS.

## New Tables
- `notifications`
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to auth.users, defaults to auth.uid())
  - `title` (text, not null) — short headline
  - `message` (text, not null) — detail body
  - `category` (text, not null) — 'due_date' | 'renewal' | 'reservation' | 'limit_reached' | 'hold'
  - `read` (boolean, default false)
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on `notifications`.
- GRANT SELECT, INSERT, UPDATE, DELETE to `authenticated` only.
- 4 owner-scoped policies (select/insert/update/delete) using auth.uid().
- `user_id` defaults to `auth.uid()` so inserts from the client succeed
  even when the client omits the user_id field.
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'renewal',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
