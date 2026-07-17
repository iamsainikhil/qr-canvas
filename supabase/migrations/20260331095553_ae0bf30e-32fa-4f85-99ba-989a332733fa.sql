-- Add explicit RLS policies for upload_rate_limits table
-- This table is only accessed by edge functions using the service role key (which bypasses RLS)
-- These policies ensure no public/authenticated user can access IP address data directly

-- Deny all access to anon and authenticated users (no SELECT policy = no read access)
-- Add a service-role-only policy comment for documentation
-- Since service_role bypasses RLS, we just need to ensure no permissive policies exist for anon/authenticated

-- Create a restrictive policy that blocks all direct access
CREATE POLICY "No public access to rate limits"
ON public.upload_rate_limits
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);