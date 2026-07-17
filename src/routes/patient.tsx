import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, ClipboardList, Phone, Search, LogIn } from "lucide-react";
import { lookupPatientHistory } from "@/lib/patient-lookup.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/patient")({ component: PatientPage });

function PatientPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [mode, setMode] = useState<"google" | "phone">("google");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-4xl">My Health Records</h1>
          <div className="inline-flex rounded-full bg-secondary/70 p-1">
            <button
              onClick={() => setMode("google")}
              className={`px-4 py-1.5 text-sm rounded-full ${mode === "google" ? "bg-background shadow" : "text-muted-foreground"}`}
            >
              <LogIn className="inline h-4 w-4 mr-1" /> Google login
            </button>
            <button
              onClick={() => setMode("phone")}
              className={`px-4 py-1.5 text-sm rounded-full ${mode === "phone" ? "bg-background shadow" : "text-muted-foreground"}`}
            >
              <Phone className="inline h-4 w-4 mr-1" /> By phone number
            </button>
          </div>
        </div>

        {mode === "google" ? (
          userId === undefined ? null : userId ? (
            <GoogleHistory userId={userId} />
          ) : (
            <Card>
              <CardContent className="py-10 text-center space-y-4">
                <p className="text-muted-foreground">Sign in with Google to view your appointments and visit history.</p>
                <Button onClick={() => navigate({ to: "/auth" })}>Sign in with Google</Button>
              </CardContent>
            </Card>
          )
        ) : (
          <PhoneHistory />
        )}
      </main>
    </div>
  );
}

function GoogleHistory({ userId }: { userId: string }) {
  const { data: appointments } = useQuery({
    queryKey: ["my-appointments", userId],
    queryFn: async () =>
      (await supabase.from("appointments").select("*, doctors(name), treatments(name)").order("appointment_date", { ascending: false })).data ?? [],
  });
  const { data: opHistory } = useQuery({
    queryKey: ["my-op", userId],
    queryFn: async () =>
      (await supabase.from("op_register").select("*, doctors(name)").order("visit_date", { ascending: false })).data ?? [],
  });
  return <HistoryView appointments={appointments ?? []} visits={opHistory ?? []} />;
}

function PhoneHistory() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<{ visits: any[]; appointments: any[]; found: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const lookup = useServerFn(lookupPatientHistory);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const r = await lookup({ data: { phone: phone.trim() } });
      setResult(r);
      if (!r.found) toast.info("No records found for this phone number.");
    } catch (err: any) {
      toast.error(err?.message ?? "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Find your history</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <Label>Registered phone number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="h-4 w-4 mr-1" /> {loading ? "Searching..." : "Search"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Enter the phone number that was recorded by the hospital during your visits.</p>
        </CardContent>
      </Card>
      {result && <HistoryView appointments={result.appointments} visits={result.visits} />}
    </div>
  );
}

function HistoryView({ appointments, visits }: { appointments: any[]; visits: any[] }) {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length ? (
            <div className="divide-y divide-border/60">
              {appointments.map((a: any) => (
                <div key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{a.appointment_date} · {a.appointment_time?.slice(0, 5)}</div>
                    <div className="text-sm text-muted-foreground">
                      {a.doctors?.name ?? "Any doctor"} · {a.treatments?.name ?? "Consultation"}
                    </div>
                  </div>
                  <Badge variant={a.status === "confirmed" ? "default" : a.status === "cancelled" ? "destructive" : "secondary"}>{a.status}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No appointments found.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Visit history (OP register)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visits.length ? (
            <div className="space-y-4">
              {visits.map((o: any) => (
                <div key={o.id} className="rounded-lg border border-border/60 p-4">
                  <div className="flex flex-wrap items-baseline gap-3 justify-between">
                    <div className="font-medium">{o.visit_date}</div>
                    <div className="text-sm text-muted-foreground">{o.doctors?.name ?? ""}</div>
                  </div>
                  {o.chief_complaint && <p className="mt-2 text-sm"><span className="font-medium">Complaint:</span> {o.chief_complaint}</p>}
                  {o.diagnosis && <p className="mt-1 text-sm"><span className="font-medium">Diagnosis:</span> {o.diagnosis}</p>}
                  {o.treatment_notes && <p className="mt-1 text-sm"><span className="font-medium">Treatment:</span> {o.treatment_notes}</p>}
                  {o.prescription && <p className="mt-1 text-sm"><span className="font-medium">Prescription:</span> {o.prescription}</p>}
                  {o.fee != null && <p className="mt-1 text-sm text-muted-foreground">Fee: ₹{o.fee}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No visits recorded.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
