ALTER TABLE public.hospital_settings
  ADD COLUMN IF NOT EXISTS map_url text,
  ADD COLUMN IF NOT EXISTS banners jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_statuses jsonb NOT NULL DEFAULT '[]'::jsonb;