import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/patient")({ component: PatientPage });

function PatientPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <div>
          <h1 className="font-serif text-4xl">My Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your upcoming and past appointment bookings. For medical/visit records, please contact the hospital reception.
          </p>
        </div>
        {userId === undefined ? null : userId ? (
          <MyAppointments userId={userId} />
        ) : (
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-muted-foreground">Sign in with Google to view your appointments.</p>
              <Button onClick={() => navigate({ to: "/auth" })}>Sign in with Google</Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function MyAppointments({ userId }: { userId: string }) {
  const { data: appointments } = useQuery({
    queryKey: ["my-appointments", userId],
    queryFn: async () =>
      (await supabase.from("appointments").select("*, doctors(name), treatments(name)").order("appointment_date", { ascending: false })).data ?? [],
  });
  const list = appointments ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" /> Appointments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length ? (
          <div className="divide-y divide-border/60">
            {list.map((a: any) => (
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
        ) : (
          <p className="text-sm text-muted-foreground">No appointments yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
