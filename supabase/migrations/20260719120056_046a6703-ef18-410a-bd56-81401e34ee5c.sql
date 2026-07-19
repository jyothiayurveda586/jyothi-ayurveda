
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  hook_url text := 'https://project--7aaeb4d2-894b-49e9-96db-36c740d71028.lovable.app/api/public/hooks/scheduled';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcHhncXlsY2praXN2d3JhY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTg3NTAsImV4cCI6MjA5OTgzNDc1MH0.veaZMVsFzpGt4LRcxZM3hQRk57VNuICbWoq-vLOibcg';
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
   WHERE jobname IN ('push-morning','push-evening','push-followup','push-appts-today');

  PERFORM cron.schedule('push-morning', '30 1 * * *', format($f$
    SELECT net.http_post(url:=%L, headers:=jsonb_build_object('Content-Type','application/json','apikey',%L), body:='{}'::jsonb);
  $f$, hook_url || '?job=morning', anon_key));

  PERFORM cron.schedule('push-evening', '30 14 * * *', format($f$
    SELECT net.http_post(url:=%L, headers:=jsonb_build_object('Content-Type','application/json','apikey',%L), body:='{}'::jsonb);
  $f$, hook_url || '?job=evening', anon_key));

  PERFORM cron.schedule('push-followup', '30 2 * * *', format($f$
    SELECT net.http_post(url:=%L, headers:=jsonb_build_object('Content-Type','application/json','apikey',%L), body:='{}'::jsonb);
  $f$, hook_url || '?job=followup', anon_key));

  PERFORM cron.schedule('push-appts-today', '0 3 * * *', format($f$
    SELECT net.http_post(url:=%L, headers:=jsonb_build_object('Content-Type','application/json','apikey',%L), body:='{}'::jsonb);
  $f$, hook_url || '?job=appointments-today', anon_key));
END $$;
