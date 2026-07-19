import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachAdminToken } from "./admin-middleware";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function b64urlDecode(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}
function verifyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload).digest("base64")
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const A = Buffer.from(sig); const B = Buffer.from(expected);
  if (A.length !== B.length) return false;
  if (!timingSafeEqual(A, B)) return false;
  try {
    const { exp } = JSON.parse(b64urlDecode(payload).toString("utf8"));
    return typeof exp === "number" && exp > Date.now();
  } catch { return false; }
}
async function requireAdmin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const token = getRequest()?.headers.get("x-admin-token");
  if (!verifyToken(token)) throw new Error("Unauthorized");
}

// Extract YouTube video ID from many URL forms.
export function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      const i = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
      if (i >= 0 && parts[i + 1]) return parts[i + 1];
    }
    return null;
  } catch { return null; }
}

// ---- Lifestyle Videos ----
const videoSchema = z.object({
  id: z.string().uuid().optional(),
  youtube_url: z.string().url(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  display_order: z.number().int().default(0),
  active: z.boolean().default(true),
});
export const adminListVideos = createServerFn({ method: "GET" })
  .middleware([attachAdminToken])
  .handler(async () => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("lifestyle_videos").select("*").order("display_order").limit(500);
    return data ?? [];
  });
export const adminSaveVideo = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: unknown) => videoSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      await supabaseAdmin.from("lifestyle_videos").update(rest).eq("id", id);
    } else {
      await supabaseAdmin.from("lifestyle_videos").insert(data);
    }
    return { ok: true };
  });
export const adminDeleteVideo = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("lifestyle_videos").delete().eq("id", data.id);
    return { ok: true };
  });

// ---- Newsletters ----
const newsletterSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  body: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional().or(z.literal("")),
  active: z.boolean().default(true),
});
export const adminListNewsletters = createServerFn({ method: "GET" })
  .middleware([attachAdminToken])
  .handler(async () => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("newsletters").select("*").order("published_at", { ascending: false }).limit(500);
    return data ?? [];
  });
export const adminSaveNewsletter = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: unknown) => newsletterSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, image_url: data.image_url || null };
    if (data.id) {
      const { id, ...rest } = payload;
      await supabaseAdmin.from("newsletters").update(rest).eq("id", id);
      return { ok: true as const, id: id as string };
    }
    const { data: inserted } = await supabaseAdmin.from("newsletters").insert(payload).select("id").maybeSingle();
    return { ok: true as const, id: (inserted?.id ?? null) as string | null };
  });
export const adminDeleteNewsletter = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("newsletters").delete().eq("id", data.id);
    return { ok: true };
  });
export const adminNotifyNewsletter = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("newsletters").select("id,title,body").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    const { sendPushToAll } = await import("./push-send.server");
    const r = await sendPushToAll({
      title: `📰 ${row.title}`,
      body: (row.body || "").slice(0, 180),
      url: "/",
    });
    await supabaseAdmin.from("newsletters").update({ notified: true }).eq("id", data.id);
    return r;
  });

// ---- Home Slides ----
const slideSchema = z.object({
  id: z.string().uuid().optional(),
  image_url: z.string().url(),
  caption: z.string().nullable().optional(),
  link_url: z.string().nullable().optional(),
  display_order: z.number().int().default(0),
  active: z.boolean().default(true),
});
export const adminListSlides = createServerFn({ method: "GET" })
  .middleware([attachAdminToken])
  .handler(async () => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("home_slides").select("*").order("display_order").limit(500);
    return data ?? [];
  });
export const adminSaveSlide = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: unknown) => slideSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      await supabaseAdmin.from("home_slides").update(rest).eq("id", id);
      return { ok: true, id };
    }
    const { data: inserted } = await supabaseAdmin.from("home_slides").insert(data).select("id").maybeSingle();
    return { ok: true, id: inserted?.id };
  });
export const adminDeleteSlide = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("home_slides").delete().eq("id", data.id);
    return { ok: true };
  });
export const adminNotifySlide = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("home_slides").select("id,caption").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    const { sendPushToAll } = await import("./push-send.server");
    const r = await sendPushToAll({
      title: "✨ New announcement",
      body: row.caption || "Check what's new at the hospital.",
      url: "/",
    });
    await supabaseAdmin.from("home_slides").update({ notified: true }).eq("id", data.id);
    return r;
  });

// Suppress unused import warnings
export const _unused = { createHash };