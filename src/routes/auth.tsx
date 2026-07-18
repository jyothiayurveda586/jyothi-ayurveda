import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const signIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: {
        prompt: "select_account",
      },
    });
    if (result.error) {
      toast.error(result.error.message || "Sign in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div>
      <SiteHeader />
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Leaf className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-serif text-3xl">Patient sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with Google to book appointments and view your visit history.
          </p>
          <Button className="mt-6 w-full" size="lg" onClick={signIn}>
            Continue with Google
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Hospital staff? <a href="/admin" className="underline">Admin login</a>
          </p>
        </div>
      </div>
    </div>
  );
}
