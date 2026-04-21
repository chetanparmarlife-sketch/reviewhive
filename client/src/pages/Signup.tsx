import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { emailSignUp, sendPhoneOtp, verifyPhoneOtp, getProfile, updateProfile } from "@/lib/db";
import { setSessionUser } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Smartphone } from "lucide-react";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  useEffect(() => { document.title = "Sign up — ReviewHive"; }, []);

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("+91 ");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, session } = await emailSignUp({
        email: form.email, password: form.password,
        name: form.name, phone: form.phone,
      });
      if (!user) throw new Error("Signup failed");
      // If email confirmations are on in Supabase, session is null and the user
      // must click the verification link. Handle both cases:
      if (!session) {
        toast({
          title: "Check your inbox",
          description: "We sent a confirmation link to " + form.email,
        });
        setLocation("/login");
        return;
      }
      const profile = await getProfile(user.id);
      if (profile) setSessionUser(profile);
      toast({ title: "Welcome to ReviewHive!", description: "Your account is ready." });
      setLocation("/campaigns");
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleSendOtp() {
    setLoading(true);
    try {
      await sendPhoneOtp(phone.replace(/\s+/g, ""));
      setOtpSent(true);
      toast({ title: "OTP sent", description: "Check WhatsApp for the 6-digit code." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }
  async function handleVerifyOtp() {
    setLoading(true);
    try {
      const { user } = await verifyPhoneOtp(phone.replace(/\s+/g, ""), otp);
      if (!user) throw new Error("OTP failed");
      // First-time OTP signup has no display name — patch the profile after.
      if (name) {
        try { await updateProfile(user.id, { name }); } catch { /* non-fatal */ }
      }
      const profile = await getProfile(user.id);
      if (profile) setSessionUser(profile);
      setLocation("/campaigns");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background honeycomb-bg">
      <nav className="h-16 px-4 md:px-6 flex items-center">
        <Link href="/"><Logo /></Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md p-6 md:p-8 border-card-border shadow-lg">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Free forever. No credit card.</p>
          </div>

          <Tabs defaultValue="email" className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="email"><Mail className="h-4 w-4 mr-2" /> Email</TabsTrigger>
              <TabsTrigger value="whatsapp"><Smartphone className="h-4 w-4 mr-2" /> WhatsApp OTP</TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <form onSubmit={handleEmail} className="space-y-3">
                <div>
                  <Label>Full name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required data-testid="input-signup-name" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required data-testid="input-signup-email" />
                </div>
                <div>
                  <Label>Phone (for UPI payouts)</Label>
                  <Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-signup-phone" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} data-testid="input-signup-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-signup">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Create account
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="whatsapp">
              <div className="space-y-3">
                <div>
                  <Label>Full name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <Label>WhatsApp number</Label>
                  <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98XXXXXXXX" />
                </div>
                {!otpSent ? (
                  <Button onClick={handleSendOtp} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Send OTP
                  </Button>
                ) : (
                  <>
                    <div>
                      <Label>Enter 6-digit OTP</Label>
                      <div className="mt-2">
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup>
                            {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                    <Button onClick={handleVerifyOtp} className="w-full" disabled={loading || otp.length !== 6}>
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Verify & create account
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="text-primary font-medium hover:underline">Log in</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
