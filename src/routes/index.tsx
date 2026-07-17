import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { publicGetBookedSlots } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Leaf, Clock, IndianRupee, MapPin, Phone, Mail, User2, Sparkles, ChevronLeft, ChevronRight, MessageCircle, Instagram } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [tab, setTab] = useState("home");
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full flex flex-wrap justify-center gap-1 bg-secondary/70 p-1 rounded-full">
            <TabsTrigger value="home" className="rounded-full px-5">Home</TabsTrigger>
            <TabsTrigger value="services" className="rounded-full px-5">Treatments & Doctors</TabsTrigger>
            <TabsTrigger value="book" className="rounded-full px-5">Book Appointment</TabsTrigger>
            <TabsTrigger value="contact" className="rounded-full px-5">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="home"><HomeSection onBook={() => setTab("book")} /></TabsContent>
          <TabsContent value="services"><ServicesSection /></TabsContent>
          <TabsContent value="book"><BookSection /></TabsContent>
          <TabsContent value="contact"><ContactSection /></TabsContent>
        </Tabs>
      </main>
      <footer className="mt-12 border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Made with care · Ancient healing, modern care
      </footer>
    </div>
  );
}

function useHospital() {
  return useQuery({
    queryKey: ["hospital-settings-public"],
    queryFn: async () => {
      const { data } = await supabase.from("hospital_settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

function HomeSection({ onBook }: { onBook: () => void }) {
  const { data: h } = useHospital();
  const banners: any[] = Array.isArray((h as any)?.banners) ? (h as any).banners : [];
  const videos: any[] = Array.isArray((h as any)?.video_statuses) ? (h as any).video_statuses : [];
  const [bannerIdx, setBannerIdx] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);
  const [openVideo, setOpenVideo] = useState<any>(null);
  const [videoIdx, setVideoIdx] = useState(0);
  const prevBanner = () => setBannerIdx((i) => (i - 1 + banners.length) % banners.length);
  const nextBanner = () => setBannerIdx((i) => (i + 1) % banners.length);
  const prevVideo = () => setVideoIdx((i) => Math.max(0, i - 1));
  const nextVideo = () => setVideoIdx((i) => Math.min(videos.length - 1, i + 1));

  return (
    <div className="mt-6 space-y-8">
      {/* Banner carousel */}
      <div className="relative overflow-hidden rounded-3xl aspect-[16/9] md:aspect-[16/7] shadow-sm bg-secondary/40">
        {banners.length > 0 ? (
          <>
            {banners.map((b, i) => (
              <div key={i} className={`absolute inset-0 transition-opacity duration-700 ${i === bannerIdx ? "opacity-100" : "opacity-0"}`}>
                {/* Blurred backdrop so any aspect ratio looks polished */}
                <img src={b.image_url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60" />
                <img
                  src={b.image_url}
                  alt={b.caption ?? "Banner"}
                  className="relative h-full w-full object-contain"
                />
              </div>
            ))}
            {banners[bannerIdx]?.caption && (
              <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/50 px-4 py-2 text-white text-sm md:text-base backdrop-blur">
                {banners[bannerIdx].caption}
              </div>
            )}
            {banners.length > 1 && (
              <>
                <button onClick={prevBanner} aria-label="Previous banner"
                  className="absolute left-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={nextBanner} aria-label="Next banner"
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => setBannerIdx(i)} aria-label={`Go to banner ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? "w-6 bg-white" : "w-2 bg-white/60"}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center p-6 bg-hero-leaf">
            <div>
              <Sparkles className="mx-auto h-8 w-8 text-primary/70" />
              <p className="mt-2 font-serif text-xl md:text-2xl text-foreground/70">Banner placeholder</p>
              <p className="text-xs text-muted-foreground">Admin can add banners in the Hospital Info tab.</p>
            </div>
          </div>
        )}
      </div>

      {/* Video statuses (WhatsApp-style carousel) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-2xl">Latest updates</h3>
          {videos.length > 4 && (
            <div className="flex gap-2">
              <button onClick={prevVideo} aria-label="Previous update"
                className="grid h-8 w-8 place-items-center rounded-full border border-border/60 hover:bg-secondary disabled:opacity-40"
                disabled={videoIdx === 0}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextVideo} aria-label="Next update"
                className="grid h-8 w-8 place-items-center rounded-full border border-border/60 hover:bg-secondary disabled:opacity-40"
                disabled={videoIdx >= videos.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="overflow-hidden">
          <div className="flex gap-4 transition-transform duration-500"
            style={{ transform: videos.length > 4 ? `translateX(-${videoIdx * 96}px)` : undefined }}>
            {videos.length > 0 ? videos.map((v, i) => (
              <button
                key={i}
                onClick={() => setOpenVideo(v)}
                className="flex flex-col items-center gap-2 shrink-0 w-20"
              >
                <span className="rounded-full p-[3px] bg-gradient-to-tr from-primary via-accent to-primary">
                  <span className="block rounded-full bg-background p-[2px]">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary text-xl">▶</span>
                    )}
                  </span>
                </span>
                <span className="text-xs text-center line-clamp-2">{v.caption ?? "Update"}</span>
              </button>
            )) : (
              <>
                {[0,1,2].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-2 shrink-0 w-20 opacity-60">
                    <span className="rounded-full p-[3px] bg-gradient-to-tr from-muted to-muted-foreground/30">
                      <span className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">▶</span>
                    </span>
                    <span className="text-xs text-muted-foreground">Placeholder</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground self-center">Admin can add video statuses.</p>
              </>
            )}
          </div>
        </div>
      </section>


      {/* Hero copy */}
      <section className="rounded-3xl bg-hero-leaf p-8 md:p-14 shadow-sm">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Classical Ayurveda since generations
          </div>
          <h1 className="mt-4 font-serif text-4xl md:text-6xl font-semibold leading-[1.05]">
            {h?.name ?? "Ayurveda Hospital"}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground italic">{h?.tagline ?? "Ancient healing, modern care"}</p>
          <p className="mt-6 text-base md:text-lg leading-relaxed text-foreground/80">
            {h?.about ?? "Welcome to our Ayurveda hospital, dedicated to authentic traditional healing."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={onBook}>Book an appointment</Button>
            <Link to="/patient"><Button size="lg" variant="outline">Patient login</Button></Link>
          </div>
        </div>
      </section>

      {/* Contact preview on home */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-serif text-2xl">Reach us</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {h?.address && <p className="inline-flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary" /><span>{h.address}</span></p>}
            {h?.phone && <p className="inline-flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-primary" /><a href={`tel:${h.phone}`} className="hover:underline">{h.phone}</a></p>}
            {h?.email && <p className="inline-flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-primary" /><a href={`mailto:${h.email}`} className="hover:underline">{h.email}</a></p>}
            {h?.hours && <p className="inline-flex items-start gap-2"><Clock className="h-4 w-4 mt-0.5 text-primary" /><span>{h.hours}</span></p>}
            {(h as any)?.map_url && (
              <a href={(h as any).map_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-primary hover:underline">
                <MapPin className="h-4 w-4" /> Open location in Google Maps
              </a>
            )}
            {((h as any)?.whatsapp_url || (h as any)?.instagram_url) && (
              <div className="flex items-center gap-2 pt-2">
                {(h as any)?.whatsapp_url && (
                  <a href={(h as any).whatsapp_url} target="_blank" rel="noreferrer"
                    aria-label="WhatsApp"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 text-[#128C7E] px-3 py-1.5 text-xs hover:bg-[#25D366]/20 transition">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
                {(h as any)?.instagram_url && (
                  <a href={(h as any).instagram_url} target="_blank" rel="noreferrer"
                    aria-label="Instagram"
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-tr from-yellow-500/15 via-pink-500/15 to-purple-500/15 text-pink-600 px-3 py-1.5 text-xs hover:opacity-90 transition">
                    <Instagram className="h-4 w-4" /> Instagram
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          {(h as any)?.map_url ? (
            <a href={(h as any).map_url} target="_blank" rel="noreferrer" className="block relative aspect-[16/10] bg-secondary/60">
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <MapPin className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-2 text-sm">Tap to open on Google Maps</p>
                </div>
              </div>
            </a>
          ) : (
            <div className="relative aspect-[16/10] bg-secondary/60 grid place-items-center text-center p-4">
              <div>
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Map link will appear here</p>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Video modal */}
      {openVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={() => setOpenVideo(null)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <video src={openVideo.video_url} controls autoPlay className="w-full rounded-2xl bg-black" />
            {openVideo.caption && <p className="mt-3 text-center text-white text-sm">{openVideo.caption}</p>}
            <button onClick={() => setOpenVideo(null)} className="mt-3 mx-auto block text-white/80 text-xs">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ServicesSection() {
  const { data: treatments } = useQuery({
    queryKey: ["treatments"],
    queryFn: async () => (await supabase.from("treatments").select("*").eq("active", true).order("display_order")).data ?? [],
  });
  const { data: doctors } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => (await supabase.from("doctors").select("*").eq("active", true).order("display_order")).data ?? [],
  });
  return (
    <div className="mt-8 space-y-10">
      <section>
        <h2 className="font-serif text-3xl mb-4">Treatments</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {treatments?.map((t) => (
            <Card key={t.id} className="border-border/60">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="font-serif text-2xl">{t.name}</CardTitle>
                  <Leaf className="h-5 w-5 text-primary/70" />
                </div>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                {t.duration_minutes && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {t.duration_minutes} min</span>}
                {t.price != null && <span className="inline-flex items-center gap-1"><IndianRupee className="h-4 w-4" /> {t.price}</span>}
              </CardContent>
            </Card>
          ))}
          {!treatments?.length && <p className="text-muted-foreground">No treatments listed yet.</p>}
        </div>
      </section>
      <section>
        <h2 className="font-serif text-3xl mb-4">Our Doctors</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {doctors?.map((d) => (
            <Card key={d.id} className="border-border/60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                    <User2 className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="font-serif text-2xl">{d.name}</CardTitle>
                    <CardDescription>{d.specialization}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {d.bio && <p className="text-muted-foreground">{d.bio}</p>}
                {d.timings && <p className="inline-flex items-center gap-1 text-xs"><Clock className="h-3.5 w-3.5" /> {d.timings}</p>}
              </CardContent>
            </Card>
          ))}
          {!doctors?.length && <p className="text-muted-foreground">No doctors listed yet.</p>}
        </div>
      </section>
    </div>
  );
}

function BookSection() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUserId(u?.id ?? null);
      setUserMeta({
        name: (u?.user_metadata as any)?.full_name ?? (u?.user_metadata as any)?.name,
        email: u?.email ?? undefined,
      });
    });
  }, []);

  const { data: treatments } = useQuery({
    queryKey: ["treatments"],
    queryFn: async () => (await supabase.from("treatments").select("id,name").eq("active", true).order("display_order")).data ?? [],
  });
  const { data: doctors } = useQuery({
    queryKey: ["doctors-full"],
    queryFn: async () => (await supabase.from("doctors").select("id,name,available_days,start_time,end_time,slot_minutes").eq("active", true).order("display_order")).data ?? [],
  });

  const [form, setForm] = useState({
    patient_name: "",
    patient_phone: "",
    doctor_id: "",
    treatment_id: "",
    appointment_date: "",
    appointment_time: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const selectedDoctor = useMemo(
    () => (doctors ?? []).find((d: any) => d.id === form.doctor_id),
    [doctors, form.doctor_id],
  );

  const getBooked = useServerFn(publicGetBookedSlots);
  const { data: bookedSlots } = useQuery({
    queryKey: ["booked-slots", form.doctor_id, form.appointment_date],
    enabled: !!form.doctor_id && !!form.appointment_date,
    queryFn: () => getBooked({ data: { doctor_id: form.doctor_id, date: form.appointment_date } }),
    staleTime: 30_000,
  });

  const slots = useMemo(() => {
    if (!selectedDoctor || !form.appointment_date) return [] as string[];
    const days: number[] = (selectedDoctor as any).available_days ?? [1,2,3,4,5,6];
    const day = new Date(`${form.appointment_date}T00:00:00`).getDay();
    if (!days.includes(day)) return [];
    const start = String((selectedDoctor as any).start_time ?? "09:00").slice(0,5);
    const end = String((selectedDoctor as any).end_time ?? "17:00").slice(0,5);
    const step = Number((selectedDoctor as any).slot_minutes ?? 30);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const out: string[] = [];
    for (let t = startMin; t + step <= endMin; t += step) {
      out.push(`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`);
    }
    return out;
  }, [selectedDoctor, form.appointment_date]);

  const bookedSet = useMemo(() => new Set((bookedSlots ?? []).map((s: string) => s.slice(0,5))), [bookedSlots]);


  useEffect(() => {
    if (userMeta.name && !form.patient_name) setForm((f) => ({ ...f, patient_name: userMeta.name! }));
  }, [userMeta.name]);

  if (!userId) {
    return (
      <div className="mt-10 mx-auto max-w-md text-center rounded-2xl border border-border/60 bg-card p-8">
        <Leaf className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 font-serif text-2xl">Sign in to book</h2>
        <p className="mt-2 text-sm text-muted-foreground">Patients sign in with Google to book appointments and view their visit history.</p>
        <Button className="mt-6" onClick={() => navigate({ to: "/auth" })}>Sign in with Google</Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_name || !form.patient_phone || !form.appointment_date || !form.appointment_time) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      patient_id: userId,
      patient_name: form.patient_name,
      patient_phone: form.patient_phone,
      doctor_id: form.doctor_id || null,
      treatment_id: form.treatment_id || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment requested — we will confirm shortly.");
    setForm({ patient_name: userMeta.name ?? "", patient_phone: "", doctor_id: "", treatment_id: "", appointment_date: "", appointment_time: "", notes: "" });
  };

  return (
    <form onSubmit={submit} className="mt-8 mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card p-6 md:p-8 space-y-4">
      <h2 className="font-serif text-3xl">Book an Appointment</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div><Label>Patient name *</Label><Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} required /></div>
        <div><Label>Phone *</Label><Input value={form.patient_phone} onChange={(e) => setForm({ ...form, patient_phone: e.target.value })} required /></div>
        <div>
          <Label>Doctor</Label>
          <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
            <SelectTrigger><SelectValue placeholder="Any available" /></SelectTrigger>
            <SelectContent>{doctors?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Treatment</Label>
          <Select value={form.treatment_id} onValueChange={(v) => setForm({ ...form, treatment_id: v })}>
            <SelectTrigger><SelectValue placeholder="Consultation / choose" /></SelectTrigger>
            <SelectContent>{treatments?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Date *</Label><Input type="date" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} required min={new Date().toISOString().slice(0,10)} /></div>
        <div className="md:col-span-2">
          <Label>Time *</Label>
          {!form.doctor_id || !form.appointment_date ? (
            <p className="text-xs text-muted-foreground mt-1">Select a doctor and date to see available time slots.</p>
          ) : slots.length === 0 ? (
            <p className="text-xs text-destructive mt-1">Doctor is not available on this day. Please pick another date.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((s) => {
                const booked = bookedSet.has(s);
                const active = form.appointment_time === s;
                return (
                  <button type="button" key={s} disabled={booked}
                    onClick={() => setForm({ ...form, appointment_time: s })}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      booked ? "bg-muted text-muted-foreground line-through cursor-not-allowed"
                        : active ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground border-border hover:bg-secondary/70"
                    }`}>
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Symptoms, concerns…" /></div>
      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? "Booking…" : "Request appointment"}
      </Button>
    </form>
  );
}

function ContactSection() {
  const { data: h } = useHospital();
  return (
    <section className="mt-8 grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="font-serif text-2xl">Visit us</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {h?.address && <p className="inline-flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary" /><span>{h.address}</span></p>}
          {h?.phone && <p className="inline-flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-primary" /><span>{h.phone}</span></p>}
          {h?.email && <p className="inline-flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-primary" /><span>{h.email}</span></p>}
          {h?.hours && <p className="inline-flex items-start gap-2"><Clock className="h-4 w-4 mt-0.5 text-primary" /><span>{h.hours}</span></p>}
          {(h as any)?.map_url && (
            <a href={(h as any).map_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
              <MapPin className="h-4 w-4" /> Open location in Google Maps
            </a>
          )}
          {!h?.address && !h?.phone && !h?.email && <p className="text-muted-foreground">Contact details will appear here once the admin adds them.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-serif text-2xl">About</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{h?.about}</p></CardContent>
      </Card>
    </section>
  );
}
