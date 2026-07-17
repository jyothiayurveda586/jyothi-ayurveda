import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Leaf, User, LogOut } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [session, setSession] = useState<{ email?: string | null; avatar?: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setSession(u ? { email: u.email, avatar: (u.user_metadata as any)?.avatar_url } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const u = s?.user;
      setSession(u ? { email: u.email, avatar: (u.user_metadata as any)?.avatar_url } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: hospital } = useQuery({
    queryKey: ["hospital-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("hospital_settings").select("name").eq("id", 1).maybeSingle();
      return data;
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
  };

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary group-hover:bg-primary/15 transition">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">{hospital?.name ?? "Ayurveda Hospital"}</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link to="/" className={`px-3 py-2 rounded-md transition ${isActive("/") ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>Home</Link>
          {session && (
            <Link to="/patient" className={`px-3 py-2 rounded-md transition ${isActive("/patient") ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>My Visits</Link>
          )}
          <Link to="/admin" className={`px-3 py-2 rounded-md transition ${pathname.startsWith("/admin") ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>Admin</Link>
        </nav>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs">
                {session.avatar ? (
                  <img src={session.avatar} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="max-w-[140px] truncate">{session.email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" variant="outline">Patient Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
