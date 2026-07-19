import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { extractYoutubeId } from "@/lib/content-admin.functions";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/lifestyle")({
  head: () => ({
    meta: [
      { title: "Lifestyle — Ayurveda tips & videos" },
      { name: "description", content: "Daily Ayurveda lifestyle tips, wellness routines, and short videos curated by our doctors." },
      { property: "og:title", content: "Lifestyle — Ayurveda tips & videos" },
      { property: "og:description", content: "Daily Ayurveda lifestyle tips, wellness routines, and short videos curated by our doctors." },
    ],
  }),
  component: LifestylePage,
});

function LifestylePage() {
  const { data: videos } = useQuery({
    queryKey: ["lifestyle-videos-public"],
    queryFn: async () =>
      (await supabase.from("lifestyle_videos").select("*").eq("active", true).order("display_order")).data ?? [],
  });

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Ayurveda lifestyle
          </div>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">Lifestyle</h1>
          <p className="mt-2 text-muted-foreground">Short videos and wellness guidance from our doctors.</p>
        </div>
        {!videos?.length ? (
          <p className="text-muted-foreground">No videos yet. Please check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((v: any) => {
              const id = extractYoutubeId(v.youtube_url);
              return (
                <div key={v.id} className="rounded-2xl overflow-hidden border border-border/60 bg-card">
                  <div className="aspect-video bg-black">
                    {id ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${id}`}
                        title={v.title ?? "Video"}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-white/60 text-sm">Invalid link</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-serif text-lg">{v.title ?? "Untitled"}</h3>
                    {v.description && <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}