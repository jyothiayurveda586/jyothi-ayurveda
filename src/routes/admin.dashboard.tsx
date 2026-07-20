import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminMe, adminLogout, adminChangePassword,
  adminSaveDoctor, adminDeleteDoctor,
  adminSaveTreatment, adminDeleteTreatment,
  adminSaveHospital,
  adminListAppointments, adminUpdateAppointmentStatus,
  adminListOp, adminSaveOp, adminDeleteOp,
  adminCreateUploadUrl, adminGetMediaUrl,
  adminListTable, adminExportAll,
  adminGetStats,
  adminSheetsSyncStatus, adminSheetsSyncInit,
  adminSheetsBackfill,
  adminSearchPatientHistory,
} from "@/lib/admin.functions";
import {
  adminListVideos, adminSaveVideo, adminDeleteVideo,
  adminListNewsletters, adminSaveNewsletter, adminDeleteNewsletter, adminNotifyNewsletter,
  adminListSlides, adminSaveSlide, adminDeleteSlide, adminNotifySlide,
} from "@/lib/content-admin.functions";
import { adminSendPush } from "@/lib/push.functions";
import { clearAdminToken, getAdminToken } from "@/lib/admin-token";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus, Pencil, Trash2, KeyRound, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/dashboard")({ component: AdminDashboard });

async function resizeImage(file: File, maxW: number, maxH: number, quality = 0.85): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Invalid image"));
    i.src = dataUrl;
  });
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Encode failed")), "image/jpeg", quality);
  });
}

function AdminDashboard() {
  const navigate = useNavigate();
  const me = useServerFn(adminMe);
  const logout = useServerFn(adminLogout);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) { navigate({ to: "/admin" }); return; }
    me().then((r) => {
      if (!r.isAdmin) { clearAdminToken(); navigate({ to: "/admin" }); }
      else setReady(true);
    });
  }, []);

  if (!ready) return null;

  const doLogout = async () => {
    await logout();
    clearAdminToken();
    navigate({ to: "/admin" });
  };

  return (
    <div>
      <SiteHeader />
      <AppointmentAlerts />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-4xl">Admin Panel</h1>
          <Button variant="outline" onClick={doLogout}><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
        </div>
        <Tabs defaultValue="op" className="w-full">
          <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 p-1">
            <TabsTrigger value="op">OP Register</TabsTrigger>
            <TabsTrigger value="appts">Appointments</TabsTrigger>
            <TabsTrigger value="history">Patient History</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="treatments">Treatments</TabsTrigger>
            <TabsTrigger value="hospital">Hospital Info</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="backup">Sheets Backup</TabsTrigger>
            <TabsTrigger value="content">Content & Push</TabsTrigger>
            <TabsTrigger value="settings">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="op"><OpRegisterTab /></TabsContent>
          <TabsContent value="appts"><AppointmentsTab /></TabsContent>
          <TabsContent value="history"><PatientHistoryTab /></TabsContent>
          <TabsContent value="stats"><StatsTab /></TabsContent>
          <TabsContent value="doctors"><DoctorsTab /></TabsContent>
          <TabsContent value="treatments"><TreatmentsTab /></TabsContent>
          <TabsContent value="hospital"><HospitalTab /></TabsContent>
          <TabsContent value="database"><DatabaseTab /></TabsContent>
          <TabsContent value="backup"><SheetsBackupTab /></TabsContent>
          <TabsContent value="content"><ContentTab /></TabsContent>
          <TabsContent value="settings"><PasswordTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------- Appointment Alert Popup ---------- */
const SEEN_KEY = "ayur-admin-seen-appts";
function getSeen(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; }
}
function addSeen(id: string) {
  const s = getSeen();
  if (!s.includes(id)) { s.push(id); localStorage.setItem(SEEN_KEY, JSON.stringify(s.slice(-500))); }
}

function AppointmentAlerts() {
  const list = useServerFn(adminListAppointments);
  const update = useServerFn(adminUpdateAppointmentStatus);
  const qc = useQueryClient();
  const [queue, setQueue] = useState<any[]>([]);
  const current = queue[0];

  const { data: appts } = useQuery({
    queryKey: ["admin-appts-poll"],
    queryFn: () => list(),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!appts) return;
    const seen = getSeen();
    const isFirstLoad = seen.length === 0;
    if (isFirstLoad) {
      // Baseline: mark existing as seen so we don't blast on first mount
      appts.forEach((a: any) => addSeen(a.id));
      return;
    }
    const fresh = appts.filter((a: any) => !seen.includes(a.id) && a.status === "pending");
    if (fresh.length) {
      setQueue((q) => {
        const existingIds = new Set(q.map((x) => x.id));
        return [...q, ...fresh.filter((f: any) => !existingIds.has(f.id))];
      });
    }
  }, [appts]);

  const handleStatus = async (status: string) => {
    if (!current) return;
    await update({ data: { id: current.id, status } });
    addSeen(current.id);
    qc.invalidateQueries({ queryKey: ["admin-appts"] });
    qc.invalidateQueries({ queryKey: ["admin-appts-poll"] });
    setQueue((q) => q.slice(1));
    toast.success(`Appointment ${status}`);
  };

  const dismiss = () => {
    if (!current) return;
    addSeen(current.id);
    setQueue((q) => q.slice(1));
  };

  return (
    <Dialog open={!!current} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Appointment Request</DialogTitle>
        </DialogHeader>
        {current && (
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Patient:</span> <strong>{current.patient_name}</strong></div>
            <div><span className="text-muted-foreground">Phone:</span> {current.patient_phone}</div>
            <div><span className="text-muted-foreground">When:</span> {current.appointment_date} {current.appointment_time?.slice(0, 5)}</div>
            <div><span className="text-muted-foreground">Doctor:</span> {current.doctors?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Treatment:</span> {current.treatments?.name ?? "—"}</div>
            {current.notes && <div><span className="text-muted-foreground">Notes:</span> {current.notes}</div>}
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={dismiss}>Later</Button>
          <Button variant="destructive" onClick={() => handleStatus("cancelled")}>Cancel</Button>
          <Button onClick={() => handleStatus("confirmed")}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ---------- OP Register ---------- */
function OpRegisterTab() {
  const list = useServerFn(adminListOp);
  const save = useServerFn(adminSaveOp);
  const del = useServerFn(adminDeleteOp);
  const qc = useQueryClient();
  const { data: ops } = useQuery({ queryKey: ["admin-op"], queryFn: () => list() });
  const { data: doctors } = useQuery({
    queryKey: ["doctors-all-admin"],
    queryFn: async () => (await supabase.from("doctors").select("id,name").order("display_order")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const openNew = () => { setEditing({ visit_date: new Date().toISOString().slice(0, 10), patient_name: "" }); setOpen(true); };
  const openEdit = (o: any) => { setEditing({ ...o }); setOpen(true); };

  const submit = async () => {
    try {
      const payload = { ...editing };
      if (payload.age === "" || payload.age == null) payload.age = null; else payload.age = Number(payload.age);
      if (payload.fee === "" || payload.fee == null) payload.fee = null; else payload.fee = Number(payload.fee);
      ["doctor_id", "patient_id"].forEach((k) => { if (!payload[k]) payload[k] = null; });
      await save({ data: payload });
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-op"] });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this OP entry?")) return;
    await del({ data: { id } });
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-op"] });
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daily OP Register</CardTitle>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />New entry</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2 pr-2">Date</th><th className="pr-2">OP#</th><th className="pr-2">Patient</th><th className="pr-2">Doctor</th><th className="pr-2">Diagnosis</th><th className="pr-2">Fee</th><th className="pr-2">Next follow-up</th><th></th></tr>
            </thead>
            <tbody>
              {ops?.map((o: any) => (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="py-2 pr-2 whitespace-nowrap">{o.visit_date}</td>
                  <td className="pr-2">{o.op_number}</td>
                  <td className="pr-2">{o.patient_name}<div className="text-xs text-muted-foreground">{o.patient_phone}</div></td>
                  <td className="pr-2">{o.doctors?.name ?? "—"}</td>
                  <td className="pr-2 max-w-xs truncate">{o.diagnosis ?? "—"}</td>
                  <td className="pr-2">{o.fee ?? "—"}</td>
                  <td className="pr-2 whitespace-nowrap">{o.next_followup_date ?? "—"}</td>
                  <td className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {!ops?.length && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit OP entry" : "New OP entry"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Visit date *</Label><Input type="date" value={editing.visit_date ?? ""} onChange={(e) => setEditing({ ...editing, visit_date: e.target.value })} /></div>
              <div>
                <Label>Doctor</Label>
                <Select value={editing.doctor_id ?? ""} onValueChange={(v) => setEditing({ ...editing, doctor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{doctors?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Patient name *</Label><Input value={editing.patient_name ?? ""} onChange={(e) => setEditing({ ...editing, patient_name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={editing.patient_phone ?? ""} onChange={(e) => setEditing({ ...editing, patient_phone: e.target.value })} /></div>
              <div><Label>Age</Label><Input type="number" value={editing.age ?? ""} onChange={(e) => setEditing({ ...editing, age: e.target.value })} /></div>
              <div>
                <Label>Gender</Label>
                <Select value={editing.gender ?? ""} onValueChange={(v) => setEditing({ ...editing, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Chief complaint</Label><Textarea value={editing.chief_complaint ?? ""} onChange={(e) => setEditing({ ...editing, chief_complaint: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Diagnosis</Label><Textarea value={editing.diagnosis ?? ""} onChange={(e) => setEditing({ ...editing, diagnosis: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Treatment notes</Label><Textarea value={editing.treatment_notes ?? ""} onChange={(e) => setEditing({ ...editing, treatment_notes: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Prescription</Label><Textarea value={editing.prescription ?? ""} onChange={(e) => setEditing({ ...editing, prescription: e.target.value })} /></div>
              <div><Label>Fee (₹)</Label><Input type="number" step="0.01" value={editing.fee ?? ""} onChange={(e) => setEditing({ ...editing, fee: e.target.value })} /></div>
              <div><Label>Next follow-up date</Label><Input type="date" value={editing.next_followup_date ?? ""} onChange={(e) => setEditing({ ...editing, next_followup_date: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Appointments ---------- */
function AppointmentsTab() {
  const list = useServerFn(adminListAppointments);
  const update = useServerFn(adminUpdateAppointmentStatus);
  const qc = useQueryClient();
  const { data: appts } = useQuery({ queryKey: ["admin-appts"], queryFn: () => list() });

  const setStatus = async (id: string, status: string) => {
    await update({ data: { id, status } });
    qc.invalidateQueries({ queryKey: ["admin-appts"] });
  };

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Appointments</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2 pr-2">When</th><th className="pr-2">Patient</th><th className="pr-2">Doctor</th><th className="pr-2">Treatment</th><th className="pr-2">Notes</th><th>Status</th></tr>
            </thead>
            <tbody>
              {appts?.map((a: any) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-2 pr-2 whitespace-nowrap">{a.appointment_date} {a.appointment_time?.slice(0, 5)}</td>
                  <td className="pr-2">{a.patient_name}<div className="text-xs text-muted-foreground">{a.patient_phone}</div></td>
                  <td className="pr-2">{a.doctors?.name ?? "—"}</td>
                  <td className="pr-2">{a.treatments?.name ?? "—"}</td>
                  <td className="pr-2 max-w-xs truncate">{a.notes ?? "—"}</td>
                  <td>
                    <Select value={a.status} onValueChange={(v) => setStatus(a.id, v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {!appts?.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No appointments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Doctors ---------- */
function DoctorsTab() {
  const save = useServerFn(adminSaveDoctor);
  const del = useServerFn(adminDeleteDoctor);
  const createUpload = useServerFn(adminCreateUploadUrl);
  const getMediaUrl = useServerFn(adminGetMediaUrl);
  const qc = useQueryClient();
  const { data: doctors } = useQuery({
    queryKey: ["doctors-all"],
    queryFn: async () => (await supabase.from("doctors").select("*").order("display_order")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing({ name: "", specialization: "", bio: "", timings: "", photo_url: null, display_order: 0, active: true, available_days: [1,2,3,4,5,6], start_time: "09:00", end_time: "17:00", slot_minutes: 30 }); setOpen(true); };
  const submit = async () => {
    if (!editing?.name?.trim() || !editing?.specialization?.trim()) {
      toast.error("Name and Specialization are required");
      return;
    }
    setSaving(true);
    try {
      await save({ data: {
        ...editing,
        name: editing.name.trim(),
        specialization: editing.specialization.trim(),
        bio: editing.bio || null,
        timings: editing.timings || null,
        photo_url: editing.photo_url || null,
        display_order: Number(editing.display_order || 0),
        slot_minutes: Number(editing.slot_minutes || 30),
        available_days: (editing.available_days ?? []).map((n: any) => Number(n)),
        start_time: (editing.start_time || "09:00").slice(0, 5),
        end_time: (editing.end_time || "17:00").slice(0, 5),
      } });
      toast.success("Saved"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["doctors-all"] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
    } catch (e: any) {
      console.error("Save doctor failed", e);
      toast.error(e?.message ?? "Failed to save doctor");
    } finally {
      setSaving(false);
    }
  };

  const onPickPhoto = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      // Auto-resize to a max of 512x512, keep aspect ratio, output JPEG.
      const resized = await resizeImage(file, 512, 512, 0.85);
      const { path, signedUrl } = await createUpload({
        data: { filename: (file.name.replace(/\.[^.]+$/, "") || "photo") + ".jpg", kind: "thumb" },
      });
      const put = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg", "x-upsert": "true" },
        body: resized,
      });
      if (!put.ok) throw new Error("Upload failed");
      const { url } = await getMediaUrl({ data: { path } });
      setEditing((prev: any) => ({ ...prev, photo_url: url }));
      toast.success("Photo uploaded");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this doctor?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["doctors-all"] });
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Doctors</CardTitle>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add doctor</Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {doctors?.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-3 min-w-0">
                {d.photo_url ? (
                  <img src={d.photo_url} alt={d.name} className="h-10 w-10 rounded-full object-cover border border-border/60 shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-sm shrink-0">
                    {(d.name || "?").trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.name} {!d.active && <Badge variant="secondary">inactive</Badge>}</div>
                  <div className="text-sm text-muted-foreground truncate">{d.specialization} · {d.timings}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing({ ...d }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {!doctors?.length && <p className="text-muted-foreground text-sm">No doctors yet.</p>}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit doctor" : "New doctor"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 rounded-full overflow-hidden border border-border/60 bg-secondary flex items-center justify-center shrink-0">
                  {editing.photo_url
                    ? <img src={editing.photo_url} alt="Doctor" className="h-full w-full object-cover" />
                    : <span className="text-2xl text-muted-foreground">
                        {(editing.name || "?").trim().charAt(0).toUpperCase()}
                      </span>}
                </div>
                <div className="grid gap-2">
                  <Label>Profile picture</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      id="doctor-photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickPhoto(f); e.target.value = ""; }}
                    />
                    <Button type="button" variant="secondary" size="sm" disabled={uploading}
                      onClick={() => document.getElementById("doctor-photo-input")?.click()}>
                      {uploading ? "Uploading…" : editing.photo_url ? "Change photo" : "Choose from gallery"}
                    </Button>
                    {editing.photo_url && (
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => setEditing({ ...editing, photo_url: null })}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-resized to 512×512.</p>
                </div>
              </div>
              <div><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Specialization *</Label><Input value={editing.specialization} onChange={(e) => setEditing({ ...editing, specialization: e.target.value })} /></div>
              <div><Label>Bio</Label><Textarea value={editing.bio ?? ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} /></div>
              <div><Label>Timings (display text)</Label><Input value={editing.timings ?? ""} onChange={(e) => setEditing({ ...editing, timings: e.target.value })} placeholder="Mon-Fri, 9 AM - 1 PM" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Start time</Label><Input type="time" value={(editing.start_time ?? "09:00").slice(0,5)} onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} /></div>
                <div><Label>End time</Label><Input type="time" value={(editing.end_time ?? "17:00").slice(0,5)} onChange={(e) => setEditing({ ...editing, end_time: e.target.value })} /></div>
                <div><Label>Slot (min)</Label><Input type="number" min={5} max={240} value={editing.slot_minutes ?? 30} onChange={(e) => setEditing({ ...editing, slot_minutes: e.target.value })} /></div>
              </div>
              <div>
                <Label>Available days</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, idx) => {
                    const on = (editing.available_days ?? []).includes(idx);
                    return (
                      <button type="button" key={d}
                        onClick={() => {
                          const cur: number[] = editing.available_days ?? [];
                          setEditing({ ...editing, available_days: on ? cur.filter((x) => x !== idx) : [...cur, idx].sort() });
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Display order</Label><Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={String(editing.active)} onValueChange={(v) => setEditing({ ...editing, active: v === "true" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="true">Active</SelectItem><SelectItem value="false">Inactive</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={saving || uploading}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Treatments ---------- */
function TreatmentsTab() {
  const save = useServerFn(adminSaveTreatment);
  const del = useServerFn(adminDeleteTreatment);
  const qc = useQueryClient();
  const { data: treatments } = useQuery({
    queryKey: ["treatments-all"],
    queryFn: async () => (await supabase.from("treatments").select("*").order("display_order")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const openNew = () => { setEditing({ name: "", display_order: 0, active: true }); setOpen(true); };
  const submit = async () => {
    try {
      await save({ data: {
        ...editing,
        display_order: Number(editing.display_order || 0),
        duration_minutes: editing.duration_minutes ? Number(editing.duration_minutes) : null,
        price: editing.price ? Number(editing.price) : null,
      }});
      toast.success("Saved"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["treatments-all"] });
      qc.invalidateQueries({ queryKey: ["treatments"] });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this treatment?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["treatments-all"] });
    qc.invalidateQueries({ queryKey: ["treatments"] });
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Treatments</CardTitle>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add treatment</Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {treatments?.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <div className="font-medium">{t.name} {!t.active && <Badge variant="secondary">inactive</Badge>}</div>
                <div className="text-sm text-muted-foreground">{t.duration_minutes ? `${t.duration_minutes} min` : ""}{t.price != null ? ` · ₹${t.price}` : ""}</div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing({ ...t }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {!treatments?.length && <p className="text-muted-foreground text-sm">No treatments yet.</p>}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit treatment" : "New treatment"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Duration (minutes)</Label><Input type="number" value={editing.duration_minutes ?? ""} onChange={(e) => setEditing({ ...editing, duration_minutes: e.target.value })} /></div>
                <div><Label>Price (₹)</Label><Input type="number" step="0.01" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Display order</Label><Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={String(editing.active)} onValueChange={(v) => setEditing({ ...editing, active: v === "true" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="true">Active</SelectItem><SelectItem value="false">Inactive</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Hospital info ---------- */
function HospitalTab() {
  const save = useServerFn(adminSaveHospital);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const getMediaUrl = useServerFn(adminGetMediaUrl);
  const qc = useQueryClient();
  const { data: h } = useQuery({
    queryKey: ["hospital-settings"],
    queryFn: async () => (await supabase.from("hospital_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [form, setForm] = useState<any>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  useEffect(() => {
    if (h) setForm({
      name: h.name, tagline: h.tagline, about: h.about,
      address: h.address, phone: h.phone, email: h.email, hours: h.hours,
      map_url: (h as any).map_url ?? "",
      whatsapp_url: (h as any).whatsapp_url ?? "",
      instagram_url: (h as any).instagram_url ?? "",
      banners: Array.isArray((h as any).banners) ? (h as any).banners : [],
      video_statuses: Array.isArray((h as any).video_statuses) ? (h as any).video_statuses : [],
    });
  }, [h]);

  if (!form) return null;

  const uploadFile = async (file: File, kind: "banner" | "video" | "thumb"): Promise<string> => {
    const up = await createUploadUrl({ data: { filename: file.name, kind } });
    const res = await fetch(up.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const { url } = await getMediaUrl({ data: { path: up.path } });
    return url;
  };

  const submit = async () => {
    try {
      await save({ data: {
        ...form,
        banners: (form.banners ?? []).filter((b: any) => b?.image_url),
        video_statuses: (form.video_statuses ?? []).filter((v: any) => v?.video_url),
      }});
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["hospital-settings"] });
      qc.invalidateQueries({ queryKey: ["hospital-settings-public"] });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const updateBanner = (i: number, patch: any) => {
    const next = [...form.banners]; next[i] = { ...next[i], ...patch }; setForm({ ...form, banners: next });
  };
  const removeBanner = (i: number) => setForm({ ...form, banners: form.banners.filter((_: any, idx: number) => idx !== i) });
  const addBanner = () => setForm({ ...form, banners: [...form.banners, { image_url: "", caption: "" }] });

  const updateVideo = (i: number, patch: any) => {
    const next = [...form.video_statuses]; next[i] = { ...next[i], ...patch }; setForm({ ...form, video_statuses: next });
  };
  const removeVideo = (i: number) => setForm({ ...form, video_statuses: form.video_statuses.filter((_: any, idx: number) => idx !== i) });
  const addVideo = () => setForm({ ...form, video_statuses: [...form.video_statuses, { video_url: "", thumbnail_url: "", caption: "" }] });

  const onBannerFile = async (i: number, file: File | null) => {
    if (!file) return;
    const key = `banner-${i}`;
    setUploading(key);
    try {
      const url = await uploadFile(file, "banner");
      updateBanner(i, { image_url: url });
      toast.success("Banner uploaded");
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setUploading(null); }
  };

  const onVideoFile = async (i: number, file: File | null, field: "video_url" | "thumbnail_url") => {
    if (!file) return;
    const key = `${field}-${i}`;
    setUploading(key);
    try {
      const url = await uploadFile(file, field === "video_url" ? "video" : "thumb");
      updateVideo(i, { [field]: url });
      toast.success("Uploaded");
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setUploading(null); }
  };

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Hospital information</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Tagline</Label><Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>About</Label><Textarea rows={4} value={form.about ?? ""} onChange={(e) => setForm({ ...form, about: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Hours</Label><Input value={form.hours ?? ""} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
        <div className="md:col-span-2">
          <Label>Google Maps location link</Label>
          <Input value={form.map_url ?? ""} onChange={(e) => setForm({ ...form, map_url: e.target.value })} placeholder="https://maps.google.com/?q=..." />
        </div>
        <div><Label>WhatsApp link</Label><Input value={form.whatsapp_url ?? ""} onChange={(e) => setForm({ ...form, whatsapp_url: e.target.value })} placeholder="https://wa.me/919999999999" /></div>
        <div><Label>Instagram link</Label><Input value={form.instagram_url ?? ""} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} placeholder="https://instagram.com/yourhospital" /></div>

        <div className="md:col-span-2 rounded-lg border border-border/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">Home page banners</Label>
            <Button type="button" size="sm" variant="outline" onClick={addBanner}><Plus className="h-4 w-4 mr-1" />Add banner</Button>
          </div>
          <div className="grid gap-3">
            {form.banners.map((b: any, i: number) => (
              <div key={i} className="grid gap-2 md:grid-cols-[auto_1fr_1fr_auto] items-center rounded-md border border-border/50 p-3">
                {b.image_url
                  ? <img src={b.image_url} alt="" className="h-16 w-24 object-cover rounded" />
                  : <div className="h-16 w-24 rounded bg-muted grid place-items-center text-xs text-muted-foreground">No image</div>}
                <div>
                  <Label className="text-xs">Image file *</Label>
                  <Input type="file" accept="image/*" disabled={uploading === `banner-${i}`}
                    onChange={(e) => onBannerFile(i, e.target.files?.[0] ?? null)} />
                  {uploading === `banner-${i}` && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
                </div>
                <div><Label className="text-xs">Caption</Label><Input value={b.caption ?? ""} onChange={(e) => updateBanner(i, { caption: e.target.value })} /></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeBanner(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            {!form.banners.length && <p className="text-xs text-muted-foreground">No banners yet. Add one and upload an image from your gallery.</p>}
          </div>
        </div>

        <div className="md:col-span-2 rounded-lg border border-border/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">Video statuses (WhatsApp-style)</Label>
            <Button type="button" size="sm" variant="outline" onClick={addVideo}><Plus className="h-4 w-4 mr-1" />Add video</Button>
          </div>
          <div className="grid gap-3">
            {form.video_statuses.map((v: any, i: number) => (
              <div key={i} className="grid gap-2 md:grid-cols-[auto_1fr_1fr_1fr_auto] items-center rounded-md border border-border/50 p-3">
                {v.thumbnail_url
                  ? <img src={v.thumbnail_url} alt="" className="h-16 w-16 object-cover rounded-full" />
                  : <div className="h-16 w-16 rounded-full bg-muted grid place-items-center text-xs text-muted-foreground">▶</div>}
                <div>
                  <Label className="text-xs">Video file *</Label>
                  <Input type="file" accept="video/*" disabled={uploading === `video_url-${i}`}
                    onChange={(e) => onVideoFile(i, e.target.files?.[0] ?? null, "video_url")} />
                  {v.video_url && <p className="text-xs text-muted-foreground mt-1 truncate">Uploaded ✓</p>}
                  {uploading === `video_url-${i}` && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
                </div>
                <div>
                  <Label className="text-xs">Thumbnail (image)</Label>
                  <Input type="file" accept="image/*" disabled={uploading === `thumbnail_url-${i}`}
                    onChange={(e) => onVideoFile(i, e.target.files?.[0] ?? null, "thumbnail_url")} />
                  {uploading === `thumbnail_url-${i}` && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
                </div>
                <div><Label className="text-xs">Caption</Label><Input value={v.caption ?? ""} onChange={(e) => updateVideo(i, { caption: e.target.value })} /></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeVideo(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            {!form.video_statuses.length && <p className="text-xs text-muted-foreground">No videos yet. Add one and upload from your gallery.</p>}
          </div>
        </div>

        <div className="md:col-span-2"><Button onClick={submit}>Save changes</Button></div>
      </CardContent>
    </Card>
  );
}

/* ---------- Password ---------- */
function PasswordTab() {
  const change = useServerFn(adminChangePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirmPw) return toast.error("New passwords don't match");
    if (next.length < 6) return toast.error("New password must be at least 6 characters");
    setLoading(true);
    const r = await change({ data: { current, next } });
    setLoading(false);
    if (!r.ok) return toast.error(r.msg ?? "Failed");
    toast.success("Password updated");
    setCurrent(""); setNext(""); setConfirmPw("");
  };

  return (
    <Card className="mt-4 max-w-md">
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Change admin password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div><Label>Current password</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
          <div><Label>New password</Label><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
          <div><Label>Confirm new password</Label><Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required /></div>
          <Button type="submit" disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

const DB_TABLES = [
  "profiles", "doctors", "treatments", "appointments",
  "op_register", "hospital_settings", "admin_config",
] as const;
type DbTable = typeof DB_TABLES[number];

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const cols = Array.from(
    rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()),
  );
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function DatabaseTab() {
  const listTable = useServerFn(adminListTable);
  const exportAll = useServerFn(adminExportAll);
  const [selected, setSelected] = useState<DbTable>("op_register");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async (t: DbTable) => {
    setLoading(true);
    try {
      const r = await listTable({ data: { table: t } });
      setRows(JSON.parse(r.json) as Array<Record<string, unknown>>);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(selected); }, [selected]);

  const cols = rows.length
    ? Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()))
    : [];

  const downloadCsv = () => {
    download(`${selected}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv");
  };
  const downloadJson = () => {
    download(`${selected}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(rows, null, 2), "application/json");
  };
  const downloadAll = async () => {
    setExporting(true);
    try {
      const r = await exportAll();
      const parsed = JSON.parse(r.json) as Record<string, Array<Record<string, unknown>>>;
      const payload = { exported_at: r.exported_at, tables: parsed };
      download(`database-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
      toast.success("Full database exported");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setExporting(false); }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3 justify-between">
          <span>Database</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={downloadCsv} disabled={!rows.length}>Download CSV</Button>
            <Button size="sm" variant="outline" onClick={downloadJson} disabled={!rows.length}>Download JSON</Button>
            <Button size="sm" onClick={downloadAll} disabled={exporting}>
              {exporting ? "Exporting…" : "Download full backup"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {DB_TABLES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={selected === t ? "default" : "outline"}
              onClick={() => setSelected(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="text-sm text-muted-foreground mb-2">
          {loading ? "Loading…" : `${rows.length} row${rows.length === 1 ? "" : "s"}`}
        </div>
        <div className="overflow-auto border rounded-md max-h-[60vh]">
          <table className="text-xs w-full">
            <thead className="bg-muted sticky top-0">
              <tr>{cols.map((c) => <th key={c} className="text-left px-2 py-1 font-medium whitespace-nowrap">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t align-top">
                  {cols.map((c) => {
                    const v = r[c];
                    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
                    return <td key={c} className="px-2 py-1 whitespace-pre-wrap break-words align-top min-w-[10rem] max-w-sm">{s}</td>;
                  })}
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr><td className="px-2 py-4 text-center text-muted-foreground" colSpan={Math.max(cols.length, 1)}>No rows</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsTab() {
  const fetchStats = useServerFn(adminGetStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
  });

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; patients: number; revenue: number; unique: Set<string> }>();
    const ops = (data?.ops ?? []) as Array<any>;
    for (const r of ops) {
      if (!r.visit_date) continue;
      const key = String(r.visit_date).slice(0, 7); // YYYY-MM
      const bucket = map.get(key) ?? { month: key, patients: 0, revenue: 0, unique: new Set<string>() };
      bucket.patients += 1;
      bucket.revenue += Number(r.fee ?? 0) || 0;
      const uid = r.patient_phone || r.patient_name;
      if (uid) bucket.unique.add(String(uid));
      map.set(key, bucket);
    }
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((b) => ({ month: b.month, patients: b.patients, unique: b.unique.size, revenue: b.revenue }));
  }, [data]);

  const totals = useMemo(() => {
    const t = monthly.reduce(
      (acc, m) => ({ patients: acc.patients + m.patients, revenue: acc.revenue + m.revenue }),
      { patients: 0, revenue: 0 },
    );
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = monthly.find((m) => m.month === cur);
    return { ...t, thisMonth };
  }, [monthly]);

  const maxRev = Math.max(1, ...monthly.map((m) => m.revenue));
  const maxPat = Math.max(1, ...monthly.map((m) => m.patients));

  if (isLoading) return <div className="mt-4 text-sm text-muted-foreground">Loading…</div>;

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Monthly patient inflow & revenue</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Total patients (OP)</div>
            <div className="text-2xl font-semibold">{totals.patients}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Total revenue</div>
            <div className="text-2xl font-semibold">₹{totals.revenue.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">This month</div>
            <div className="text-2xl font-semibold">
              {totals.thisMonth?.patients ?? 0} <span className="text-sm text-muted-foreground">visits · ₹{(totals.thisMonth?.revenue ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Patient inflow by month</div>
          <div className="space-y-2">
            {monthly.length === 0 && <div className="text-sm text-muted-foreground">No data yet.</div>}
            {monthly.map((m) => (
              <div key={m.month} className="grid grid-cols-[80px_1fr_60px] items-center gap-3 text-sm">
                <div className="text-muted-foreground">{m.month}</div>
                <div className="h-3 rounded bg-secondary overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(m.patients / maxPat) * 100}%` }} />
                </div>
                <div className="text-right">{m.patients}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Revenue by month (₹)</div>
          <div className="space-y-2">
            {monthly.map((m) => (
              <div key={m.month} className="grid grid-cols-[80px_1fr_100px] items-center gap-3 text-sm">
                <div className="text-muted-foreground">{m.month}</div>
                <div className="h-3 rounded bg-secondary overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${(m.revenue / maxRev) * 100}%` }} />
                </div>
                <div className="text-right">₹{m.revenue.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Google Sheets Backup ---------- */
function SheetsBackupTab() {
  const status = useServerFn(adminSheetsSyncStatus);
  const init = useServerFn(adminSheetsSyncInit);
  const backfill = useServerFn(adminSheetsBackfill);
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["sheets-sync-status"],
    queryFn: () => status(),
  });
  const [busy, setBusy] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    if (data && !data.secretConfigured) {
      init().then(() => refetch()).catch(() => {});
    }
  }, [data?.secretConfigured]);

  const doInit = async () => {
    setBusy(true);
    try {
      await init();
      await refetch();
      toast.success("Sync configured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const doBackfill = async () => {
    setBackfilling(true);
    try {
      const r = await backfill();
      const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
      toast.success(`Backed up ${total} rows to Google Sheets`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBackfilling(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Google Sheets Backup</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Every insert, update, and delete on doctors, treatments, appointments,
          OP register, and hospital settings is mirrored into a Google Sheet on
          your connected account. The spreadsheet is created automatically on the
          first change after setup.
        </p>
        {isLoading ? <p>Loading…</p> : (
          <div className="space-y-2">
            <div>Webhook: <span className="font-mono text-xs break-all">{data?.webhookUrl ?? "—"}</span></div>
            <div>
              Sync secret: {data?.secretConfigured
                ? <Badge>Configured</Badge>
                : <Badge variant="destructive">Not configured</Badge>}
            </div>
            <div>
              Spreadsheet: {data?.spreadsheetUrl ? (
                <a className="text-primary underline" href={data.spreadsheetUrl} target="_blank" rel="noreferrer">
                  Open in Google Sheets
                </a>
              ) : <span className="text-muted-foreground">Will be created on first change</span>}
            </div>
          </div>
        )}
        <Button onClick={doInit} disabled={busy}>
          {busy ? "Working…" : "Re-configure sync"}
        </Button>
        <Button onClick={doBackfill} disabled={backfilling} variant="secondary" className="ml-2">
          {backfilling ? "Backing up…" : "Back up everything now"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Content & Push ---------- */
function ContentTab() {
  return (
    <div className="mt-4 space-y-6">
      <PushBroadcastCard />
      <SlidesCard />
      <VideosCard />
      <NewslettersCard />
    </div>
  );
}

function PushBroadcastCard() {
  const send = useServerFn(adminSendPush);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and body required");
    setBusy(true);
    try {
      const r = await send({ data: { title: title.trim(), body: body.trim() } });
      toast.success(`Sent to ${r.sent}/${r.total}`);
      setTitle(""); setBody("");
    } catch (e: any) { toast.error(e.message ?? "Failed"); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Broadcast push notification</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send to all subscribers"}</Button>
      </CardContent>
    </Card>
  );
}

function SlidesCard() {
  const list = useServerFn(adminListSlides);
  const save = useServerFn(adminSaveSlide);
  const del = useServerFn(adminDeleteSlide);
  const notify = useServerFn(adminNotifySlide);
  const qc = useQueryClient();
  const { data: slides } = useQuery({ queryKey: ["admin-slides"], queryFn: () => list() });
  const [form, setForm] = useState<any>({ image_url: "", caption: "", link_url: "", display_order: 0, active: true });
  const add = async () => {
    if (!form.image_url) return toast.error("Image URL required");
    try {
      const r = await save({ data: { ...form, display_order: Number(form.display_order) || 0 } });
      toast.success("Saved");
      setForm({ image_url: "", caption: "", link_url: "", display_order: 0, active: true });
      qc.invalidateQueries({ queryKey: ["admin-slides"] });
      if (r.id && confirm("Notify subscribers about this announcement?")) {
        await notify({ data: { id: r.id } });
        toast.success("Notification sent");
      }
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this slide?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-slides"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle>Home slides / Announcements</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" /></div>
          <div><Label>Link URL (optional)</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Caption</Label><Input value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></div>
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Add slide</Button>
        <ul className="divide-y divide-border/60">
          {slides?.map((s: any) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <img src={s.image_url} alt="" className="h-10 w-16 object-cover rounded" />
              <span className="flex-1 text-sm truncate">{s.caption || s.image_url}</span>
              <Button variant="ghost" size="sm" onClick={() => notify({ data: { id: s.id } }).then(() => toast.success("Notified")).catch((e: any) => toast.error(e.message))}>Notify</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </li>
          ))}
          {!slides?.length && <li className="py-4 text-sm text-muted-foreground">No slides yet.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

function VideosCard() {
  const list = useServerFn(adminListVideos);
  const save = useServerFn(adminSaveVideo);
  const del = useServerFn(adminDeleteVideo);
  const qc = useQueryClient();
  const { data: videos } = useQuery({ queryKey: ["admin-videos"], queryFn: () => list() });
  const [form, setForm] = useState<any>({ youtube_url: "", title: "", description: "", display_order: 0, active: true });
  const add = async () => {
    if (!form.youtube_url) return toast.error("YouTube URL required");
    try {
      await save({ data: { ...form, display_order: Number(form.display_order) || 0 } });
      toast.success("Saved");
      setForm({ youtube_url: "", title: "", description: "", display_order: 0, active: true });
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this video?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-videos"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle>Lifestyle YouTube videos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>YouTube URL</Label><Input value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://youtube.com/watch?v=…" /></div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Add video</Button>
        <ul className="divide-y divide-border/60">
          {videos?.map((v: any) => (
            <li key={v.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-sm truncate">{v.title || v.youtube_url}</span>
              <a href={v.youtube_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open</a>
              <Button variant="ghost" size="icon" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </li>
          ))}
          {!videos?.length && <li className="py-4 text-sm text-muted-foreground">No videos yet.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

function NewslettersCard() {
  const list = useServerFn(adminListNewsletters);
  const save = useServerFn(adminSaveNewsletter);
  const del = useServerFn(adminDeleteNewsletter);
  const notify = useServerFn(adminNotifyNewsletter);
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["admin-newsletters"], queryFn: () => list() });
  const [form, setForm] = useState<any>({ title: "", body: "", image_url: "", active: true });
  const add = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    try {
      const r = await save({ data: { ...form, image_url: form.image_url || undefined } });
      toast.success("Saved");
      setForm({ title: "", body: "", image_url: "", active: true });
      qc.invalidateQueries({ queryKey: ["admin-newsletters"] });
      if (r.id && confirm("Notify subscribers about this newsletter?")) {
        await notify({ data: { id: r.id } });
        toast.success("Notification sent");
      }
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this newsletter?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-newsletters"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle>Newsletters</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Image URL (optional)</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Body</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Publish newsletter</Button>
        <ul className="divide-y divide-border/60">
          {items?.map((n: any) => (
            <li key={n.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-sm truncate">{n.title}</span>
              <Button variant="ghost" size="sm" onClick={() => notify({ data: { id: n.id } }).then(() => toast.success("Notified")).catch((e: any) => toast.error(e.message))}>Notify</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </li>
          ))}
          {!items?.length && <li className="py-4 text-sm text-muted-foreground">No newsletters yet.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

function PatientHistoryTab() {
  const search = useServerFn(adminSearchPatientHistory);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    visits: any[];
    appointments: any[];
    found: boolean;
  } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const r = await search({ data: { query: q } });
      setResult(r);
      if (!r.found) toast.info("No records found.");
    } catch (err: any) {
      toast.error(err?.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Search patient history</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <Label>Phone number or patient name</Label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. 9876543210 or Ramesh"
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="h-4 w-4 mr-1" /> {loading ? "Searching..." : "Search"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Searches OP register visits and appointment bookings. Numeric input matches phone; text matches name.
          </p>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">
                Visits ({result.visits.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.visits.length ? (
                <div className="space-y-4">
                  {result.visits.map((o: any) => (
                    <div key={o.id} className="rounded-lg border border-border/60 p-4">
                      <div className="flex flex-wrap items-baseline gap-3 justify-between">
                        <div className="font-medium">
                          {o.visit_date} · OP #{o.op_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {o.doctors?.name ?? ""}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {o.patient_name}
                        {o.patient_phone ? ` · ${o.patient_phone}` : ""}
                        {o.age ? ` · ${o.age}${o.gender ? "/" + o.gender : ""}` : ""}
                      </div>
                      {o.chief_complaint && (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">Complaint:</span> {o.chief_complaint}
                        </p>
                      )}
                      {o.diagnosis && (
                        <p className="mt-1 text-sm">
                          <span className="font-medium">Diagnosis:</span> {o.diagnosis}
                        </p>
                      )}
                      {o.treatment_notes && (
                        <p className="mt-1 text-sm">
                          <span className="font-medium">Treatment:</span> {o.treatment_notes}
                        </p>
                      )}
                      {o.prescription && (
                        <p className="mt-1 text-sm">
                          <span className="font-medium">Prescription:</span> {o.prescription}
                        </p>
                      )}
                      {o.next_followup_date && (
                        <p className="mt-1 text-sm">
                          <span className="font-medium">Next follow-up:</span> {o.next_followup_date}
                        </p>
                      )}
                      {o.fee != null && (
                        <p className="mt-1 text-sm text-muted-foreground">Fee: ₹{o.fee}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No visits found.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">
                Appointments ({result.appointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.appointments.length ? (
                <div className="divide-y divide-border/60">
                  {result.appointments.map((a: any) => (
                    <div key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {a.appointment_date} · {a.appointment_time?.slice(0, 5)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {a.patient_name}
                          {a.patient_phone ? ` · ${a.patient_phone}` : ""} ·{" "}
                          {a.doctors?.name ?? "Any doctor"} ·{" "}
                          {a.treatments?.name ?? "Consultation"}
                        </div>
                      </div>
                      <Badge
                        variant={
                          a.status === "confirmed"
                            ? "default"
                            : a.status === "cancelled"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No appointments found.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
