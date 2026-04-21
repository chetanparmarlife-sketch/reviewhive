import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { emailSignIn, getProfile, signOut } from "@/lib/db";
import { setSessionUser } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  useEffect(() => { document.title = "Admin login — ReviewHive"; }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await emailSignIn(email, password);
      if (!user) throw new Error("No user returned");
      const profile = await getProfile(user.id);
      if (!profile) throw new Error("Profile not found. Contact support.");
      if (profile.role !== "admin") {
        // Non-admin signed in — immediately sign out to avoid giving them an admin session.
        await signOut();
        toast({
          title: "Not an admin account",
          description: "Use /login for reviewer access.",
          variant: "destructive",
        });
        return;
      }
      if (profile.is_blocked) {
        await signOut();
        toast({ title: "Account blocked", description: "Contact support.", variant: "destructive" });
        return;
      }
      setSessionUser(profile);
      setLocation("/admin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <nav className="h-16 px-4 md:px-6 flex items-center">
        <Link href="/"><Logo /></Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md p-6 md:p-8 border-card-border shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin portal</h1>
              <p className="text-xs text-muted-foreground">ReviewHive team access only</p>
            </div>
          </div>
          <form onSubmit={handle} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="input-admin-email" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required data-testid="input-admin-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-admin-login">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Log in
            </Button>
            <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50 border border-border">
              Admin accounts must be created in Supabase Dashboard then marked
              <code className="mx-1 px-1 rounded bg-background border border-border">role='admin'</code>
              in the <code className="px-1 rounded bg-background border border-border">profiles</code> table.
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
