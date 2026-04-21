import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCampaignsWithBrand, listApplicationsForUser } from "@/lib/db";
import { qk } from "@/lib/queryClient";
import type { Campaign, Application } from "@shared/schema";
import { Link } from "wouter";
import { ReviewerLayout } from "@/components/ReviewerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MarketplaceBadge } from "@/components/MarketplaceBadge";
import { formatRupees, useSession } from "@/lib/session";
import { Search, Hexagon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MARKETPLACES = [
  { id: "all", label: "All marketplaces" },
  { id: "amazon_in", label: "Amazon" },
  { id: "flipkart", label: "Flipkart" },
  { id: "meesho", label: "Meesho" },
];
const REWARD_TIERS = [
  { id: "all", label: "Any reward" },
  { id: "low", label: "Under ₹400" },
  { id: "mid", label: "₹400–₹700" },
  { id: "high", label: "Over ₹700" },
];

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
  const [marketplace, setMarketplace] = useState("all");
  const [rewardTier, setRewardTier] = useState("all");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    const s = new Set<string>();
    campaigns.forEach(c => c.category && s.add(c.category));
    return ["all", ...Array.from(s)];
  }, [campaigns]);

  const appliedIds = new Set(myApps.map(a => a.campaign_id));

  const filtered = useMemo(() => {
    return campaigns
      .filter(c => c.status === "live")
      .filter(c => !q || c.title.toLowerCase().includes(q.toLowerCase()) || c.brand?.name.toLowerCase().includes(q.toLowerCase()))
      .filter(c => marketplace === "all" || c.marketplace === marketplace)
      .filter(c => category === "all" || c.category === category)
      .filter(c => {
        if (rewardTier === "all") return true;
        if (rewardTier === "low") return c.reward_amount < 400;
        if (rewardTier === "mid") return c.reward_amount >= 400 && c.reward_amount <= 700;
        if (rewardTier === "high") return c.reward_amount > 700;
        return true;
      });
  }, [campaigns, q, marketplace, rewardTier, category]);

  return (
    <ReviewerLayout title="Campaigns">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Live campaigns</h2>
          <p className="text-sm text-muted-foreground">Pick a campaign, get approved, review, get paid.</p>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns or brands…"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="pl-10"
              data-testid="input-search-campaigns"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {MARKETPLACES.map(m => (
              <Button
                key={m.id}
                variant={marketplace === m.id ? "default" : "outline"}
                size="sm"
                onClick={() => setMarketplace(m.id)}
                data-testid={`filter-marketplace-${m.id}`}
              >{m.label}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {REWARD_TIERS.map(r => (
              <Button
                key={r.id}
                variant={rewardTier === r.id ? "default" : "outline"}
                size="sm"
                onClick={() => setRewardTier(r.id)}
                data-testid={`filter-reward-${r.id}`}
              >{r.label}</Button>
            ))}
          </div>
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <Button
                  key={c}
                  variant={category === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(c)}
                >{c === "all" ? "All categories" : c}</Button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-72 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Hexagon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <div className="font-semibold">No campaigns match your filters</div>
            <p className="text-sm text-muted-foreground mt-1">Try clearing filters or check back soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const filledPct = (c.slots_filled / c.total_slots) * 100;
              const isApplied = appliedIds.has(c.id);
              const isFull = c.slots_filled >= c.total_slots;
              return (
                <Link key={c.id} href={`/campaigns/${c.id}`}>
                  <Card className="overflow-hidden hover-elevate cursor-pointer border-card-border h-full" data-testid={`card-campaign-${c.id}`}>
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
                        <span>{c.category}</span>
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
