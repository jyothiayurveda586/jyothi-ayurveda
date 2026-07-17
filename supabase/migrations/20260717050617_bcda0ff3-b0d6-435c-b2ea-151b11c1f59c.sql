DROP POLICY IF EXISTS "Public read hospital-media" ON storage.objects;

CREATE POLICY "Public read hospital-media public folders"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'hospital-media'
  AND (storage.foldername(name))[1] IN ('banner', 'video', 'thumb')
);