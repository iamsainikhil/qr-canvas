-- Create storage bucket for QR code files (PDFs, images, MP3s)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qr-files', 
  'qr-files', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/mp3']
);

-- Allow anyone to read files (public bucket)
CREATE POLICY "Public read access for qr-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'qr-files');

-- Allow anyone to upload files (for simplicity - no auth required)
CREATE POLICY "Public upload access for qr-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'qr-files');

-- Allow anyone to delete their uploaded files
CREATE POLICY "Public delete access for qr-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'qr-files');