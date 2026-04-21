import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Hexagon, Search, SlidersHorizontal } from "lucide-react";

import { listApplicationsForUser, listCampaignsWithBrand } from "@/lib/db";
import { qk } from "@/lib/queryClient";
import { formatRupees, useSession } from "@/lib/session";
import type { Application, Campaign } from "@shared/schema";

import { ReviewerLayout } from "@/components/ReviewerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceBadge } from "@/components/MarketplaceBadge";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Posted just now";
  if (minutes < 60) return `Posted ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Posted ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Posted ${days}d ago`;
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function featureTag(campaign: Campaign): string {
  if (campaign.reward_amount >= 1000) return "HIGH TICKET";
  if (campaign.reward_amount >= 700) return "TRENDING";
  return "NEW";
}

export default function Campaigns() {
  const user = useSession();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: qk.reviewerCampaigns(user?.id),
    queryFn: listCampaignsWithBrand,
    enabled: !!user,
  });
  const { data: myApps = [] } = useQuery<Application[]>({
    queryKey: qk.applicationsForUser(user?.id),
    queryFn: () => (user ? listApplicationsForUser(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const [q, setQ] = useState("");
  const [chip, setChip] = useState("all");

  const appliedIds = new Set(myApps.map((a) => a.campaign_id));

  const liveCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === "live"),
    [campaigns],
  );

  const chips = useMemo(() => {
    const uniq = new Set<string>();
    liveCampaigns.forEach((c) => {
      if (c.category) uniq.add(c.category);
    });
    return ["all", ...Array.from(uniq).slice(0, 8)];
  }, [liveCampaigns]);

  const featured = useMemo(
    () => [...liveCampaigns].sort((a, b) => b.reward_amount - a.reward_amount).slice(0, 8),
    [liveCampaigns],
  );

  const forYou = useMemo(() => {
    return liveCampaigns
      .filter((c) => {
        if (!q) return true;
        const term = q.toLowerCase();
        return (
          c.title.toLowerCase().includes(term) ||
          c.brand?.name?.toLowerCase().includes(term) ||
          c.category?.toLowerCase().includes(term)
        );
      })
      .filter((c) => chip === "all" || c.category === chip || c.marketplace === chip)
      .sort((a, b) => b.reward_amount - a.reward_amount);
  }, [liveCampaigns, q, chip]);

  return (
    <ReviewerLayout title="Discover">
      <div className="md:hidden px-4 py-4 space-y-6">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search campaigns, brands..."
            className="h-12 pl-9 pr-11 rounded-xl bg-card/90 border-border"
            data-testid="input-search-campaigns"
          />
          <button
            type="button"
            onClick={() => {
              setQ("");
              setChip("all");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
            aria-label="Reset filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {chips.map((entry) => {
            const active = chip === entry;
            return (
              <button
                key={entry}
                onClick={() => setChip(entry)}
                className={`shrink-0 h-9 px-4 rounded-full text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-card/85 border border-border text-muted-foreground"
                }`}
                data-testid={`filter-chip-${entry}`}
              >
                {entry === "all" ? "All" : cleanLabel(entry)}
              </button>
            );
          })}
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[1.75rem] font-bold tracking-tight">Featured Opportunities</h3>
            <button
              className="text-primary text-sm font-semibold"
              onClick={() => {
                setQ("");
                setChip("all");
              }}
            >
              See All
            </button>
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-3 snap-x snap-mandatory">
            {featured.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <article
                  className="snap-center shrink-0 w-[18.5rem] h-52 rounded-2xl overflow-hidden relative border border-white/10"
                  data-testid={`featured-campaign-${c.id}`}
                >
                  {c.cover_image_url ? (
                    <img src={c.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500 via-amber-400 to-emerald-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="inline-flex text-[10px] font-bold rounded px-2 py-0.5 mb-2 bg-white/30 text-white border border-white/25">
                      {featureTag(c)}
                    </div>
                    <h4 className="text-white text-2xl font-bold leading-tight mb-1 line-clamp-2">{c.title}</h4>
                    <p className="text-primary font-bold text-lg">
                      {formatRupees(c.reward_amount)}
                      <span className="text-white/80 font-medium text-sm"> • {c.total_slots - c.slots_filled} slots left</span>
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3 pb-3">
          <h3 className="text-[1.75rem] font-bold tracking-tight">For You</h3>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : forYou.length === 0 ? (
            <div className="text-center py-16">
              <Hexagon className="h-14 w-14 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">No campaigns match your filters</p>
              <p className="text-sm text-muted-foreground mt-1">Try a different keyword or category.</p>
            </div>
          ) : (
            forYou.map((c) => {
              const isApplied = appliedIds.has(c.id);
              const tags = [cleanLabel(c.marketplace), cleanLabel(c.category)].filter(Boolean).slice(0, 2);
              return (
                <Link key={c.id} href={`/campaigns/${c.id}`}>
                  <article className="bg-card/90 rounded-2xl p-4 border border-border shadow-sm active:scale-[0.99] transition-transform" data-testid={`card-campaign-${c.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 rounded-full border border-border overflow-hidden bg-muted shrink-0">
                          {c.brand?.logo_url ? (
                            <img src={c.brand.logo_url} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-base truncate">{c.brand?.name ?? "Brand"}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-primary font-extrabold text-2xl leading-none">{formatRupees(c.reward_amount)}</p>
                        {isApplied ? <p className="text-[11px] text-emerald-500 mt-1">Applied</p> : null}
                      </div>
                    </div>

                    {c.cover_image_url ? (
                      <div className="w-full h-44 rounded-xl bg-cover bg-center mb-4 relative overflow-hidden" style={{ backgroundImage: `url(${c.cover_image_url})` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                        <div className="absolute bottom-2 left-2 flex gap-1">
                          {tags.map((tag) => (
                            <div key={tag} className="backdrop-blur-md bg-black/45 rounded px-2 py-1 border border-white/15">
                              <span className="text-[11px] text-white font-medium">{tag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-16 rounded-xl bg-muted/60 mb-4 flex items-center px-3">
                        <span className="text-xs text-muted-foreground">{tags.join(" • ") || "Campaign"}</span>
                      </div>
                    )}

                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="font-bold text-[1.75rem] md:text-2xl leading-tight line-clamp-2">{c.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1 truncate">{c.description || "Tap to view campaign details and apply."}</p>
                      </div>
                      <div className="bg-primary/15 text-primary p-2.5 rounded-lg shrink-0">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })
          )}
        </section>
      </div>

      <div className="hidden md:block p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Live campaigns</h2>
          <p className="text-sm text-muted-foreground">Pick a campaign, get approved, review, get paid.</p>
        </div>

        <div className="space-y-3">
          <div className="relative max-w-xl">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns or brands..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((entry) => (
              <Button
                key={entry}
                variant={chip === entry ? "default" : "outline"}
                size="sm"
                onClick={() => setChip(entry)}
              >
                {entry === "all" ? "All categories" : cleanLabel(entry)}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-72 rounded-lg" />
            ))}
          </div>
        ) : forYou.length === 0 ? (
          <div className="text-center py-20">
            <Hexagon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <div className="font-semibold">No campaigns match your filters</div>
            <p className="text-sm text-muted-foreground mt-1">Try clearing filters or check back soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {forYou.map((c) => {
              const filledPct = (c.slots_filled / c.total_slots) * 100;
              const isApplied = appliedIds.has(c.id);
              const isFull = c.slots_filled >= c.total_slots;
              return (
                <Link key={c.id} href={`/campaigns/${c.id}`}>
                  <Card className="overflow-hidden hover-elevate cursor-pointer border-card-border h-full" data-testid={`desktop-campaign-${c.id}`}>
                    <div className="h-32 relative bg-muted">
                      {c.cover_image_url && <img src={c.cover_image_url} alt="" className="w-full h-full object-cover" />}
                      <div className="absolute top-3 left-3">
                        <MarketplaceBadge marketplace={c.marketplace} size="md" />
                      </div>
                      {isApplied && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary/95 text-primary-foreground text-[10px] font-semibold">
                          Applied
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                        {c.brand?.logo_url && <img src={c.brand.logo_url} alt="" className="h-5 w-5 rounded" />}
                        <span>{c.brand?.name}</span>
                        <span>·</span>
                        <span>{cleanLabel(c.category)}</span>
                      </div>
                      <div className="font-semibold mb-3 line-clamp-2 leading-snug">{c.title}</div>
                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Reward</div>
                          <div className="text-2xl font-bold text-primary tabular-nums leading-tight">{formatRupees(c.reward_amount)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Slots</div>
                          <div className="text-sm font-semibold tabular-nums">{c.total_slots - c.slots_filled} left</div>
                        </div>
                      </div>
                      <Progress value={filledPct} className="h-1.5 mb-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="tabular-nums">{c.slots_filled}/{c.total_slots} filled</span>
                        {isFull ? <span className="text-destructive font-semibold">Full</span> : <span>Apply now →</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </ReviewerLayout>
  );
}
