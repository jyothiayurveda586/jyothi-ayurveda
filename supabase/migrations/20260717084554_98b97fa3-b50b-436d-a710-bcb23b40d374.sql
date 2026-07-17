
-- Extension for HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Config table for integration state (spreadsheet ID, etc.)
CREATE TABLE IF NOT EXISTS public.sync_config (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_config TO authenticated;
GRANT ALL ON public.sync_config TO service_role;

ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

-- Only service role reads/writes this via the webhook; no client policies.

-- Store webhook URL + secret so the trigger can post to it.
-- Values inserted here are read by the trigger function.
INSERT INTO public.sync_config (key, value) VALUES
  ('sheets_sync_url', 'https://project--7aaeb4d2-894b-49e9-96db-36c740d71028.lovable.app/api/public/hooks/sheets-sync')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- The secret is inserted separately by a server-side call (or admin) — pull from env at runtime is not possible in SQL,
-- so we store it in sync_config. Set it via the app or via an INSERT.
-- Placeholder row so trigger doesn't fail if unset (will be filled by app deploy step).
INSERT INTO public.sync_config (key, value)
VALUES ('sheets_sync_secret', '')
ON CONFLICT (key) DO NOTHING;

-- Trigger function: POST row payload to the sync webhook via pg_net.
CREATE OR REPLACE FUNCTION public.notify_sheets_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  webhook_url text;
  webhook_secret text;
  payload jsonb;
BEGIN
  SELECT value INTO webhook_url FROM public.sync_config WHERE key = 'sheets_sync_url';
  SELECT value INTO webhook_secret FROM public.sync_config WHERE key = 'sheets_sync_secret';

  IF webhook_url IS NULL OR webhook_url = '' OR webhook_secret IS NULL OR webhook_secret = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'record', to_jsonb(NEW),
    'old_record', to_jsonb(OLD)
  );

  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', webhook_secret
    ),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never break the underlying write if the sync call fails.
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers to each business table.
DROP TRIGGER IF EXISTS trg_sheets_sync ON public.op_register;
CREATE TRIGGER trg_sheets_sync
AFTER INSERT OR UPDATE OR DELETE ON public.op_register
FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();

DROP TRIGGER IF EXISTS trg_sheets_sync ON public.appointments;
CREATE TRIGGER trg_sheets_sync
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();

DROP TRIGGER IF EXISTS trg_sheets_sync ON public.doctors;
CREATE TRIGGER trg_sheets_sync
AFTER INSERT OR UPDATE OR DELETE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();

DROP TRIGGER IF EXISTS trg_sheets_sync ON public.treatments;
CREATE TRIGGER trg_sheets_sync
AFTER INSERT OR UPDATE OR DELETE ON public.treatments
FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();

DROP TRIGGER IF EXISTS trg_sheets_sync ON public.hospital_settings;
CREATE TRIGGER trg_sheets_sync
AFTER INSERT OR UPDATE OR DELETE ON public.hospital_settings
FOR EACH ROW EXECUTE FUNCTION public.notify_sheets_sync();
