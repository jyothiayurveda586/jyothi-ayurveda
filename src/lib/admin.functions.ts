import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { attachAdminToken } from "./admin-middleware";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function sha256hex(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const A = Buffer.from(a, "hex");
  const B = Buffer.from(b, "hex");
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function signToken(exp: number): string {
  const payload = b64url(Buffer.from(JSON.stringify({ a: 1, exp }), "utf8"));
  const sig = b64url(
    createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest(),
  );
  return `${payload}.${sig}`;
}

function verifyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = b64url(
    createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest(),
  );
  const A = Buffer.from(sig);
  const B = Buffer.from(expected);
  if (A.length !== B.length) return false;
  if (!timingSafeEqual(A, B)) return false;
  try {
    const { exp } = JSON.parse(b64urlDecode(payload).toString("utf8"));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

function currentToken(): string | null {
  const req = getRequest();
  return req?.headers.get("x-admin-token") ?? null;
}

async function requireAdmin() {
  if (!verifyToken(currentToken())) throw new Error("Unauthorized");
}

export const adminMe = createServerFn({ method: "GET" })
  .middleware([attachAdminToken])
  .handler(async () => {
    return { isAdmin: verifyToken(currentToken()) };
  });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("admin_config")
      .select("password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (error || !row) return { ok: false as const, token: null };
    if (!safeEqualHex(row.password_hash, sha256hex(data.password)))
      return { ok: false as const, token: null };
    const token = signToken(Date.now() + TOKEN_TTL_MS);
    return { ok: true as const, token };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true as const };
});

export const adminChangePassword = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { current: string; next: string }) =>
    z.object({ current: z.string().min(1), next: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("admin_config")
      .select("password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (!row || !safeEqualHex(row.password_hash, sha256hex(data.current))) {
      return { ok: false as const, msg: "Current password is incorrect" };
    }
    await supabaseAdmin
      .from("admin_config")
      .update({ password_hash: sha256hex(data.next), updated_at: new Date().toISOString() })
      .eq("id", 1);
    return { ok: true as const };
  });

// ---- Doctors ----
const doctorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  specialization: z.string().min(1),
  bio: z.string().nullable().optional(),
  timings: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  display_order: z.number().int().default(0),
  active: z.boolean().default(true),
  available_days: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
  start_time: z.string().default("09:00"),
  end_time: z.string().default("17:00"),
  slot_minutes: z.number().int().min(5).max(240).default(30),
});


export const adminSaveDoctor = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: unknown) => doctorSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      await supabaseAdmin.from("doctors").update(rest).eq("id", id);
    } else {
      await supabaseAdmin.from("doctors").insert(data);
    }
    return { ok: true };
  });

export const adminDeleteDoctor = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("doctors").delete().eq("id", data.id);
    return { ok: true };
  });

// ---- Treatments ----
const treatmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  duration_minutes: z.number().int().nullable().optional(),
  price: z.number().nullable().optional(),
  display_order: z.number().int().default(0),
  active: z.boolean().default(true),
});
export const adminSaveTreatment = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: unknown) => treatmentSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      await supabaseAdmin.from("treatments").update(rest).eq("id", id);
    } else {
      await supabaseAdmin.from("treatments").insert(data);
    }
    return { ok: true };
  });
export const adminDeleteTreatment = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("treatments").delete().eq("id", data.id);
    return { ok: true };
  });

// ---- Media upload (banners/videos) ----
export const adminCreateUploadUrl = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { filename: string; kind: "banner" | "video" | "thumb" }) =>
    z.object({
      filename: z.string().min(1).max(200),
      kind: z.enum(["banner", "video", "thumb"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("hospital-media")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Failed to create upload URL");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const adminGetMediaUrl = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // 10-year signed URL (bucket is private; policy allows anon read)
    const { data: signed, error } = await supabaseAdmin.storage
      .from("hospital-media")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 10);
    if (error || !signed) throw new Error(error?.message ?? "Failed to create signed URL");
    return { url: signed.signedUrl };
  });

// ---- Hospital settings ----
const hospitalSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().nullable().optional(),
  about: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  hours: z.string().nullable().optional(),
  map_url: z.string().nullable().optional(),
  whatsapp_url: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),
  banners: z
    .array(z.object({ image_url: z.string().min(1), caption: z.string().nullable().optional() }))
    .default([]),
  video_statuses: z
    .array(
      z.object({
        video_url: z.string().min(1),
        thumbnail_url: z.string().nullable().optional(),
        caption: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

export const adminSaveHospital = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: unknown) => hospitalSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("hospital_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    return { ok: true };
  });

// ---- Appointments ----
export const adminListAppointments = createServerFn({ method: "GET" })
  .middleware([attachAdminToken])
  .handler(async () => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("appointments")
      .select("*, doctors(name), treatments(name)")
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false })
      .limit(500);
    return data ?? [];
  });
export const adminUpdateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string; status: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("appointments").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

// ---- OP register ----
const opSchema = z.object({
  id: z.string().uuid().optional(),
  patient_id: z.string().uuid().nullable().optional(),
  patient_name: z.string().min(1),
  patient_phone: z.string().nullable().optional(),
  age: z.number().int().nullable().optional(),
  gender: z.string().nullable().optional(),
  doctor_id: z.string().uuid().nullable().optional(),
  visit_date: z.string(),
  chief_complaint: z.string().nullable().optional(),
  diagnosis: z.string().nullable().optional(),
  treatment_notes: z.string().nullable().optional(),
  prescription: z.string().nullable().optional(),
  fee: z.number().nullable().optional(),
});
export const adminListOp = createServerFn({ method: "GET" })
  .middleware([attachAdminToken])
  .handler(async () => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("op_register")
      .select("*, doctors(name)")
      .order("visit_date", { ascending: false })
      .limit(500);
    return data ?? [];
  });
export const adminSaveOp = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: unknown) => opSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      await supabaseAdmin.from("op_register").update(rest).eq("id", id);
    } else {
      await supabaseAdmin.from("op_register").insert(data);
    }
    return { ok: true };
  });
// ---- Database viewer / export ----
const DB_TABLES = [
  "profiles", "doctors", "treatments", "appointments",
  "op_register", "hospital_settings", "admin_config",
] as const;

export const adminListTable = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { table: string }) =>
    z.object({ table: z.enum(DB_TABLES) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from(data.table)
      .select("*")
      .limit(2000);
    if (error) throw new Error(error.message);
    let out = (rows ?? []) as Array<Record<string, unknown>>;
    if (data.table === "admin_config") {
      out = out.map((r) => ({ ...r, password_hash: "***" }));
    }
    return { json: JSON.stringify(out) };
  });

export const adminExportAll = createServerFn({ method: "GET" })
  .middleware([attachAdminToken])
  .handler(async () => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<string, Array<Record<string, unknown>>> = {};
    for (const t of DB_TABLES) {
      const { data } = await supabaseAdmin.from(t).select("*").limit(10000);
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      out[t] = t === "admin_config"
        ? rows.map((r) => ({ ...r, password_hash: "***" }))
        : rows;
    }
    return {
      exported_at: new Date().toISOString(),
      json: JSON.stringify(out),
    };
  });

export const adminDeleteOp = createServerFn({ method: "POST" })
  .middleware([attachAdminToken])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("op_register").delete().eq("id", data.id);
    return { ok: true };
  });

// ---- Stats (monthly patient inflow + revenue) ----
export const adminGetStats = createServerFn({ method: "GET" })
  .middleware([attachAdminToken])
  .handler(async () => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ops } = await supabaseAdmin
      .from("op_register")
      .select("visit_date, fee, patient_phone, patient_name")
      .order("visit_date", { ascending: false })
      .limit(10000);
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("appointment_date, status")
      .limit(10000);
    return { ops: ops ?? [], appts: appts ?? [] };
  });

// ---- Public: booked slots for a doctor+date (no auth) ----
export const publicGetBookedSlots = createServerFn({ method: "POST" })
  .inputValidator((d: { doctor_id: string; date: string }) =>
    z.object({ doctor_id: z.string().uuid(), date: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("appointments")
      .select("appointment_time, status")
      .eq("doctor_id", data.doctor_id)
      .eq("appointment_date", data.date)
      .neq("status", "cancelled");
    return (rows ?? []).map((r: any) => r.appointment_time as string);
  });
