import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminLogin, adminMe } from "@/lib/admin.functions";
import { setAdminToken } from "@/lib/admin-token";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({ component: AdminLogin });

function AdminLogin() {
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);
  const me = useServerFn(adminMe);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    me().then((r) => { if (r.isAdmin) navigate({ to: "/admin/dashboard" }); });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const r = await login({ data: { password } });
    setLoading(false);
    if (!r.ok || !r.token) return toast.error("Incorrect password");
    setAdminToken(r.token);
    navigate({ to: "/admin/dashboard" });
  };

  return (
    <div>
      <SiteHeader />
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Shield className="h-7 w-7" />
            </div>
            <h1 className="mt-4 font-serif text-3xl">Admin login</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter the admin password to manage the hospital.</p>
          </div>
          <div className="mt-6 space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="mt-6 w-full" size="lg" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="mt-2 text-center text-xs">
            <Link to="/" className="text-muted-foreground hover:underline">← Back to site</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
