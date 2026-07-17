
-- Revoke direct execute; trigger runs as owner and doesn't need public execute.
REVOKE EXECUTE ON FUNCTION public.notify_sheets_sync() FROM PUBLIC, anon, authenticated;

-- Revoke Data API access to sync_config; it is service-role only.
REVOKE ALL ON public.sync_config FROM anon, authenticated;
