import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

type Payload = {
  table: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  record: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
};

function gwHeaders() {
  return {
    Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": process.env.GOOGLE_SHEETS_API_KEY ?? "",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function gw(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gwHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function ensureSpreadsheet(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sync_config")
    .select("value")
    .eq("key", "sheets_backup_spreadsheet_id")
    .maybeSingle();
  if (data?.value) return data.value as string;
  const created = await gw("/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: `Hospital DB Backup - ${new Date().toISOString().slice(0, 10)}` },
    }),
  });
  const id = created.spreadsheetId as string;
  await supabaseAdmin
    .from("sync_config")
    .upsert({ key: "sheets_backup_spreadsheet_id", value: id });
  return id;
}

function columnLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function ensureTab(
  spreadsheetId: string,
  table: string,
  columns: string[],
): Promise<void> {
  const meta = await gw(`/spreadsheets/${spreadsheetId}?fields=sheets.properties`);
  const existing: Array<{ properties: { title: string } }> = meta.sheets ?? [];
  const has = existing.some((s) => s.properties.title === table);
  if (!has) {
    await gw(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: table } } }],
      }),
    });
  }
  const header = ["_synced_at", "_op", ...columns];
  const endCol = columnLetter(header.length);
  await gw(
    `/spreadsheets/${spreadsheetId}/values/${table}!A1:${endCol}1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [header] }) },
  );
}

function toCell(v: unknown): string | number | boolean {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean" || typeof v === "number") return v;
  return String(v);
}

async function findRowById(
  spreadsheetId: string,
  table: string,
  id: string,
): Promise<number | null> {
  const range = `${table}!C2:C`;
  const res = await gw(
    `/spreadsheets/${spreadsheetId}/values/${range}`,
  );
  const values: string[][] = res.values ?? [];
  for (let i = 0; i < values.length; i++) {
    if (values[i]?.[0] === id) return i + 2;
  }
  return null;
}

async function syncRecord(payload: Payload) {
  const spreadsheetId = await ensureSpreadsheet();
  const rec = payload.record ?? payload.old_record ?? {};
  const columns = Object.keys(rec);
  if (columns.length === 0) return;
  await ensureTab(spreadsheetId, payload.table, columns);

  const id = String((rec as Record<string, unknown>).id ?? "");
  const row = [
    new Date().toISOString(),
    payload.op,
    ...columns.map((c) => toCell((rec as Record<string, unknown>)[c])),
  ];
  const endCol = columnLetter(row.length);

  const existingRow = id ? await findRowById(spreadsheetId, payload.table, id) : null;
  if (existingRow) {
    await gw(
      `/spreadsheets/${spreadsheetId}/values/${payload.table}!A${existingRow}:${endCol}${existingRow}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [row] }) },
    );
  } else {
    await gw(
      `/spreadsheets/${spreadsheetId}/values/${payload.table}!A:${endCol}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [row] }) },
    );
  }
}

export const Route = createFileRoute("/api/public/hooks/sheets-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-sync-secret");
        if (!secret || secret !== process.env.SHEETS_SYNC_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }
        let payload: Payload;
        try {
          payload = (await request.json()) as Payload;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (!payload?.table || !payload?.op) {
          return new Response("Missing fields", { status: 400 });
        }
        try {
          await syncRecord(payload);
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[sheets-sync]", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});