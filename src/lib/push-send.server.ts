// Server-only push sender used by cron/webhook routes.

export async function sendPushToAll(payload: {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@ayurveda.local",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .limit(5000);
  const list = subs ?? [];
  const body = JSON.stringify(payload);
  const stale: string[] = [];
  let sent = 0;
  await Promise.all(
    list.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent += 1;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) stale.push(s.id);
      }
    }),
  );
  if (stale.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
  }
  return { sent, removed: stale.length, total: list.length };
}