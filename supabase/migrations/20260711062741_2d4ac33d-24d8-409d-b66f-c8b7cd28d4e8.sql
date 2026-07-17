CREATE POLICY "Public read hospital-media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'hospital-media');