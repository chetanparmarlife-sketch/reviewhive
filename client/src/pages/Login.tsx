import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { emailSignIn, sendPhoneOtp, verifyPhoneOtp, getProfile } from "@/lib/db";
import { setSessionUser } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Smartphone } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  useEffect(() => {
    document.title = "Log in — ReviewHive";
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      toast({ title: "Email confirmation failed", description: authError, variant: "destructive" });
      params.delete("auth_error");
      const search = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
    }
  }, [toast]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);

  const [phone, setPhone] = useState("+91 ");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoadingEmail(true);
    try {
      const { user } = await emailSignIn(email, password);
      if (!user) throw new Error("Login failed");
      const profile = await getProfile(user.id);
      if (!profile) throw new Error("Profile not found — contact support");
      if (profile.is_blocked) throw new Error("Your account has been suspended");
      setSessionUser(profile);
      toast({ title: "Welcome back" });
      if (profile.role === "admin") setLocation("/admin");
      else setLocation("/campaigns");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally { setLoadingEmail(false); }
  }

  async function handleSendOtp() {
    setLoadingPhone(true);
    try {
      await sendPhoneOtp(phone.replace(/\s+/g, ""));
      setOtpSent(true);
      toast({ title: "OTP sent via WhatsApp", description: "Check your WhatsApp for the 6-digit code." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setLoadingPhone(false); }
  }
  async function handleVerifyOtp() {
    setLoadingPhone(true);
    try {
      const { user } = await verifyPhoneOtp(phone.replace(/\s+/g, ""), otp);
      if (!user) throw new Error("OTP verification failed");
      const profile = await getProfile(user.id);
      if (!profile) throw new Error("Profile not found");
      setSessionUser(profile);
      toast({ title: "Logged in" });
      setLocation("/campaigns");
    } catch (err: any) {
      toast({ title: "OTP failed", description: err.message, variant: "destructive" });
    } finally { setLoadingPhone(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background honeycomb-bg">
      <nav className="h-16 px-4 md:px-6 flex items-center">
        <Link href="/"><Logo /></Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md p-6 md:p-8 border-card-border shadow-lg">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Log in to access your campaigns and payouts.</p>
          </div>

          <Tabs defaultValue="email" className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="email" data-testid="tab-email"><Mail className="h-4 w-4 mr-2" /> Email</TabsTrigger>
              <TabsTrigger value="whatsapp" data-testid="tab-whatsapp"><Smartphone className="h-4 w-4 mr-2" /> WhatsApp OTP</TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="input-email" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required data-testid="input-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loadingEmail} data-testid="button-login-email">
                  {loadingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Log in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="whatsapp">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="phone">WhatsApp number</Label>
                  <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98XXXXXXXX" data-testid="input-phone" />
                </div>
                {!otpSent ? (
                  <Button type="button" onClick={handleSendOtp} className="w-full" disabled={loadingPhone} data-testid="button-send-otp">
                    {loadingPhone ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Send OTP on WhatsApp
                  </Button>
                ) : (
                  <>
                    <div>
                      <Label>Enter 6-digit OTP</Label>
                      <div className="mt-2">
                        <InputOTP maxLength={6} value={otp} onChange={setOtp} data-testid="input-otp">
                          <InputOTPGroup>
                            {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                    <Button onClick={handleVerifyOtp} className="w-full" disabled={loadingPhone || otp.length !== 6} data-testid="button-verify-otp">
                      {loadingPhone ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Verify & log in
                    </Button>
                    <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }} className="text-xs text-muted-foreground hover:text-foreground">Change number</button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            New here? <Link href="/signup" className="text-primary font-medium hover:underline" data-testid="link-to-signup">Create an account</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
