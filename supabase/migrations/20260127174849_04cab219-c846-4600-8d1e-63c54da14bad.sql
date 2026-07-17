-- Remove overly permissive storage policies
DROP POLICY IF EXISTS "Public upload access for qr-files" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access for qr-files" ON storage.objects;

-- Keep public read access (needed for QR codes to work) but restrict upload/delete
-- Only the service role (Edge Function) can upload files now
-- No public delete access - files can only be deleted by service role