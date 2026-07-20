
-- Remove overly-permissive INSERT policy on push_subscriptions.
-- All subscription writes go through the server-side savePushSubscription
-- function which uses the service-role client (bypasses RLS).
DROP POLICY IF EXISTS "anyone can subscribe" ON public.push_subscriptions;

-- Restrictive deny for any direct client writes.
CREATE POLICY "Block client inserts to push_subscriptions"
  ON public.push_subscriptions
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Block client updates to push_subscriptions"
  ON public.push_subscriptions
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block client deletes from push_subscriptions"
  ON public.push_subscriptions
  AS RESTRICTIVE
  FOR DELETE
  TO anon, authenticated
  USING (false);
