import { createFileRoute } from "@tanstack/react-router";

// Scheduled push endpoint. Called by pg_cron with apikey header + ?job=<name>.
// Jobs: morning, evening, followup, appointments-today
export const Route = createFileRoute("/api/public/hooks/scheduled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!apikey || !expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = new URL(request.url);
        const job = url.searchParams.get("job") || "";
        const { sendPushToAll } = await import("@/lib/push-send.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (job === "morning") {
          const r = await sendPushToAll({
            title: "🌅 Good morning",
            body: "Wishing you a healthy, balanced day from your Ayurveda hospital.",
            url: "/",
          });
          return Response.json({ job, ...r });
        }
        if (job === "evening") {
          const r = await sendPushToAll({
            title: "🌙 Good evening",
            body: "Rest well tonight — Ayurveda recommends winding down before 10 PM.",
            url: "/",
          });
          return Response.json({ job, ...r });
        }
        if (job === "followup") {
          const today = new Date().toISOString().slice(0, 10);
          const { data: due } = await supabaseAdmin
            .from("op_register")
            .select("patient_name")
            .eq("next_followup_date", today)
            .limit(500);
          const count = due?.length ?? 0;
          if (count === 0) return Response.json({ job, skipped: true });
          const r = await sendPushToAll({
            title: "🌿 Follow-up reminder",
            body: count === 1
              ? `${due![0].patient_name} has a follow-up scheduled today.`
              : `${count} patients have follow-ups scheduled today.`,
            url: "/admin/dashboard",
          });
          return Response.json({ job, count, ...r });
        }
        if (job === "appointments-today") {
          const today = new Date().toISOString().slice(0, 10);
          const { data: appts } = await supabaseAdmin
            .from("appointments")
            .select("appointment_time, patient_name")
            .eq("appointment_date", today)
            .neq("status", "cancelled")
            .order("appointment_time");
          const n = appts?.length ?? 0;
          if (n === 0) return Response.json({ job, skipped: true });
          const r = await sendPushToAll({
            title: "📅 Appointments today",
            body: `${n} appointment${n === 1 ? "" : "s"} scheduled today.`,
            url: "/admin/dashboard",
          });
          return Response.json({ job, count: n, ...r });
        }
        return new Response("Unknown job", { status: 400 });
      },
    },
  },
});