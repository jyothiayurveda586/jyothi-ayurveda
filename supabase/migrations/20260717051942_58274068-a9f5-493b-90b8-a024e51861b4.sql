
ALTER TABLE public.hospital_settings
  ADD COLUMN IF NOT EXISTS whatsapp_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS available_days int[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS start_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS end_time time NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS slot_minutes int NOT NULL DEFAULT 30;
