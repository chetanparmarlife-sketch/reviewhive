import { Link } from "wouter";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketplaceBadge } from "@/components/MarketplaceBadge";
import { formatRupees } from "@/lib/session";
import { ArrowRight, CheckCircle2, Shield, Zap, IndianRupee, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { listCampaignsWithBrand } from "@/lib/db";
import { qk } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";

export default function Landing() {
  useEffect(() => { document.title = "ReviewHive — Honest reviews for Indian marketplaces"; }, []);
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: qk.publicCampaigns,
    queryFn: listCampaignsWithBrand,
  });
  const featured = campaigns.filter(c => c.status === "live").slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="h-16 border-b border-border sticky top-0 bg-background/85 backdrop-blur z-30">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-4 md:px-6">
          <Link href="/"><Logo /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login"><Button variant="ghost" data-testid="link-login">Log in</Button></Link>
            <Link href="/signup"><Button data-testid="link-signup">Get started</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden honeycomb-bg">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-16 md:pb-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold mb-6 border border-primary/30">
              <Star className="h-3 w-3 fill-primary" /> Trusted by 200+ Indian DTC brands
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-foreground">
              Earn <span className="text-primary">₹200–₹2,000</span> per honest review.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-lg">
              ReviewHive connects you with brands on Amazon India, Flipkart, and Meesho. Buy a product, share your honest feedback, get paid to your UPI.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/signup">
                <Button size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-hero-signup">
                  Start earning <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-hero-login">
                  I have an account
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> UPI payouts</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> WhatsApp OTP</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Verified brands</div>
            </div>
          </div>

          {/* Hero visual - honeycomb */}
          <div className="relative hidden md:block">
            <div className="relative aspect-square max-w-md mx-auto">
              <svg viewBox="0 0 400 400" className="w-full h-full">
                <defs>
                  <linearGradient id="heroHex" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="hsl(38, 92%, 60%)" />
                    <stop offset="1" stopColor="hsl(30, 85%, 45%)" />
                  </linearGradient>
                </defs>
                {/* Hex grid background */}
                {[0, 1, 2].map((row) =>
                  [0, 1, 2, 3].map((col) => {
                    const x = 60 + col * 90 + (row % 2) * 45;
                    const y = 60 + row * 78;
                    const op = 0.1 + ((row + col) % 4) * 0.06;
                    return (
                      <polygon
                        key={`${row}-${col}`}
                        points={`${x},${y-42} ${x+36},${y-21} ${x+36},${y+21} ${x},${y+42} ${x-36},${y+21} ${x-36},${y-21}`}
                        fill="hsl(38, 92%, 50%)"
                        opacity={op}
                      />
                    );
                  })
                )}
                {/* Central big hex with icon */}
                <polygon
                  points="200,80 296,135 296,245 200,300 104,245 104,135"
                  fill="url(#heroHex)"
                  stroke="hsl(30, 40%, 15%)"
                  strokeWidth="3"
                />
                <text x="200" y="200" textAnchor="middle" dominantBaseline="middle" fontSize="96" fontWeight="700" fill="hsl(30, 40%, 15%)" fontFamily="system-ui">₹</text>
                {/* Review stars */}
                <g transform="translate(140,330)">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <polygon
                      key={i}
                      points={`${i * 25 + 8},0 ${i * 25 + 12},8 ${i * 25 + 20},8 ${i * 25 + 14},14 ${i * 25 + 16},22 ${i * 25 + 8},17 ${i * 25},22 ${i * 25 + 2},14 ${i * 25 - 4},8 ${i * 25 + 4},8`}
                      fill="hsl(38, 92%, 55%)"
                    />
                  ))}
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "12,000+", l: "Reviews delivered" },
            { v: "200+", l: "Brands on board" },
            { v: "₹48 Lakh", l: "Paid to reviewers" },
            { v: "4.6 ★", l: "Avg reviewer rating" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl md:text-3xl font-bold text-primary tabular-nums">{s.v}</div>
              <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">How it works</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Four steps. Your UPI is happy.</h2>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { n: "01", t: "Sign up", d: "Email or WhatsApp OTP — takes 30 seconds." },
            { n: "02", t: "Pick a campaign", d: "Browse live campaigns on Amazon, Flipkart, Meesho. Apply." },
            { n: "03", t: "Buy & review", d: "Get approved, pick a product, buy it, share your honest review." },
            { n: "04", t: "Get paid", d: "We verify your review, pay to your UPI within 48 hours." },
          ].map((s, i) => (
            <Card key={s.n} className="border-card-border hover-elevate">
              <CardContent className="p-6">
                <div className="text-4xl font-bold text-primary/30 tabular-nums mb-2">{s.n}</div>
                <div className="font-semibold text-lg mb-1">{s.t}</div>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured campaigns */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-20">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Live right now</div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Featured campaigns</h2>
            </div>
            <Link href="/signup"><Button variant="outline" className="gap-2">See all <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {featured.map((c: any) => (
              <Card key={c.id} className="overflow-hidden hover-elevate border-card-border">
                <div className="h-36 relative bg-muted">
                  {c.cover_image_url && <img src={c.cover_image_url} alt="" className="w-full h-full object-cover" />}
                  <div className="absolute top-3 left-3">
                    <MarketplaceBadge marketplace={c.marketplace} size="md" />
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    {c.brand?.logo_url && <img src={c.brand.logo_url} alt="" className="h-5 w-5 rounded" />}
                    {c.brand?.name}
                  </div>
                  <div className="font-semibold mb-3 line-clamp-2">{c.title}</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Reward</div>
                      <div className="text-lg font-bold text-primary tabular-nums">{formatRupees(c.reward_amount)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Slots</div>
                      <div className="text-sm font-semibold tabular-nums">{c.total_slots - c.slots_filled}/{c.total_slots}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / why */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24 grid md:grid-cols-3 gap-8">
        {[
          { i: Shield, t: "Only verified brands", d: "We vet every brand before they post a campaign. No MLM, no drop-shippers." },
          { i: Zap, t: "Pay within 48 hours", d: "Verified reviews get paid to your UPI in under 2 days. Always." },
          { i: IndianRupee, t: "Earn in rupees, to UPI", d: "No wallet sitting on cash. Direct to your HDFC, ICICI, or any UPI ID." },
        ].map((b) => (
          <div key={b.t}>
            <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-4">
              <b.i className="h-5 w-5" />
            </div>
            <div className="font-semibold text-lg mb-1.5">{b.t}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{b.d}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-primary/10 border-y border-primary/20 honeycomb-bg">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Ready to turn honest reviews into income?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">Join 12,000+ Indian reviewers. Signup takes 30 seconds.</p>
          <Link href="/signup">
            <Button size="lg" className="gap-2" data-testid="button-cta-signup">Sign up free <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={24} />
            <span className="text-xs text-muted-foreground">© 2025 · Prototype, not a real service</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/admin/login" className="hover:text-foreground" data-testid="link-admin-login">Admin access</Link>
            <span>·</span>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <span>·</span>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
