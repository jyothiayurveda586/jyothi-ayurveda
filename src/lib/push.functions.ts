import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachAdminToken } from "./admin-middleware";

// Public VAPID key exposed to browser to build a PushSubscription.
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
});

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  user_agent: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          user_agent: data.user_agent ?? null,
          topic: data.topic ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    return { ok: true };
  });

async function sendToAll(payload: { title: string; body: string; url?: string; icon?: string }) {
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

// Admin: send arbitrary broadcast.
export const adminSendPush = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { title: string; body: string; url?: string; topic?: string }) =>
    z.object({
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(500),
      url: z.string().optional(),
      topic: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    // Admin auth check
    const { getRequest } = await import("@tanstack/react-start/server");
    const token = getRequest()?.headers.get("x-admin-token");
    // Re-use same verify as admin.functions — inlined light check via env secret
    if (!token) throw new Error("Unauthorized");
    // Trust token presence + tag: verifyToken runs elsewhere; we perform HMAC verify here too
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const parts = token.split(".");
    if (parts.length !== 2) throw new Error("Unauthorized");
    const [payload, sig] = parts;
    const expected = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(payload).digest("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const A = Buffer.from(sig); const B = Buffer.from(expected);
    if (A.length !== B.length || !timingSafeEqual(A, B)) throw new Error("Unauthorized");
    const { sendPushToAll } = await import("./push-send.server");
    return await sendPushToAll(
      { title: data.title, body: data.body, url: data.url },
      data.topic ? { topic: data.topic } : undefined,
    );
  });

// Public: called by client right after an appointment is successfully booked.
// Verifies the appointment exists to avoid arbitrary spam.
export const notifyNewAppointment = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("patient_name, appointment_date, appointment_time, doctors(name)")
      .eq("id", data.id)
      .maybeSingle();
    if (!appt) return { ok: false as const };
    const doctor = (appt as any).doctors?.name ? ` with Dr. ${(appt as any).doctors.name}` : "";
    const { sendPushToAll } = await import("./push-send.server");
    // Only admin devices should learn about patient bookings.
    const res = await sendPushToAll(
      {
        title: "📅 New appointment booked",
        body: `${appt.patient_name}${doctor} — ${appt.appointment_date} at ${appt.appointment_time}`,
        url: "/admin/dashboard",
      },
      { topic: "admin" },
    );
    return { ok: true as const, sent: res.sent };
  });
