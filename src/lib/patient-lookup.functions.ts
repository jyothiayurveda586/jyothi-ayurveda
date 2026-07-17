import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const lookupPatientHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) =>
    z.object({ phone: z.string().trim().min(4).max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.trim();
    const { data: visits } = await supabaseAdmin
      .from("op_register")
      .select("id, visit_date, patient_name, age, gender, chief_complaint, diagnosis, treatment_notes, prescription, fee, doctors(name)")
      .eq("patient_phone", phone)
      .order("visit_date", { ascending: false })
      .limit(200);
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id, appointment_date, appointment_time, status, patient_name, notes, doctors(name), treatments(name)")
      .eq("patient_phone", phone)
      .order("appointment_date", { ascending: false })
      .limit(200);
    return {
      found: (visits?.length ?? 0) > 0 || (appts?.length ?? 0) > 0,
      visits: visits ?? [],
      appointments: appts ?? [],
    };
  });
