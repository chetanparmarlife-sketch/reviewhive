import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ReviewerLayout } from "@/components/ReviewerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MarketplaceBadge, StatusBadge } from "@/components/MarketplaceBadge";
import { formatRupees, useSession } from "@/lib/session";
import { queryClient, qk } from "@/lib/queryClient";
import { getCampaignDetail, listApplicationsForUser, applyToCampaign, updateOwnApplication } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import type { Campaign, Application } from "@shared/schema";

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const user = useSession();
  const { toast } = useToast();

  const { data: campaign, isLoading } = useQuery<Campaign | null>({
    queryKey: qk.campaign(id!),
    queryFn: () => getCampaignDetail(id!),
    enabled: !!id,
  });

  const { data: myApps = [] } = useQuery<Application[]>({
    queryKey: qk.applicationsForUser(user?.id),
    queryFn: () => (user ? listApplicationsForUser(user.id) : Promise.resolve([])),
    enabled: !!user,
  });
  const myApp = myApps.find(a => a.campaign_id === id);

  const applyMutation = useMutation({
    mutationFn: () => applyToCampaign(id!),
    onSuccess: () => {
      toast({ title: "Application submitted", description: "We'll review and get back to you." });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: qk.campaign(id!) });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const [selectedProd, setSelectedProd] = useState<string | null>(null);
  const reserveMutation = useMutation({
    mutationFn: (productId: string) =>
      updateOwnApplication(myApp!.id, { status: "reserved", product_id: productId }),
    onSuccess: () => {
      toast({ title: "Product reserved", description: "Buy the product and upload your order screenshot next." });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: qk.campaign(id!) });
      setLocation("/applications");
    },
    onError: (err: Error) => toast({ title: "Reserve failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !campaign) {
    return (
      <ReviewerLayout title="Campaign">
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </ReviewerLayout>
    );
  }

  const reqs: string[] = Array.isArray(campaign.requirements) ? campaign.requirements : [];
  const filledPct = (campaign.slots_filled / campaign.total_slots) * 100;
  const isFull = campaign.slots_filled >= campaign.total_slots;

  const canApply = !myApp && campaign.status === "live" && !isFull;
  const canReserve = myApp && myApp.status === "approved";

  return (
    <ReviewerLayout title={campaign.title}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>

        {/* Hero */}
        <Card className="overflow-hidden border-card-border">
          <div className="h-40 md:h-56 relative bg-muted">
            {campaign.cover_image_url && <img src={campaign.cover_image_url} alt="" className="w-full h-full object-cover" />}
            <div className="absolute top-4 left-4"><MarketplaceBadge marketplace={campaign.marketplace} size="md" /></div>
          </div>
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center gap-3 mb-3">
              {campaign.brand?.logo_url && <img src={campaign.brand.logo_url} alt="" className="h-10 w-10 rounded-lg" />}
              <div>
                <div className="text-sm text-muted-foreground">{campaign.brand?.name} · {campaign.category}</div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">{campaign.title}</h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{campaign.description}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
              <div>
                <div className="text-xs text-muted-foreground">Reward</div>
                <div className="text-lg md:text-xl font-bold text-primary tabular-nums">{formatRupees(campaign.reward_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Slots</div>
                <div className="text-lg md:text-xl font-semibold tabular-nums">{campaign.total_slots - campaign.slots_filled} / {campaign.total_slots}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Starts</div>
                <div className="text-sm md:text-base font-medium">{new Date(campaign.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Ends</div>
                <div className="text-sm md:text-base font-medium">{new Date(campaign.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
              </div>
            </div>
            <Progress value={filledPct} className="h-1.5 mt-4" />
            <div className="text-xs text-muted-foreground mt-1 tabular-nums">{campaign.slots_filled} of {campaign.total_slots} slots filled</div>

            <div className="mt-5">
              {myApp ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/40">
                  <StatusBadge status={myApp.status} size="md" />
                  <span className="text-sm flex-1">Your current status</span>
                  <Link href="/applications"><Button variant="outline" size="sm" data-testid="button-view-application">View</Button></Link>
                </div>
              ) : isFull ? (
                <Button disabled className="w-full md:w-auto" data-testid="button-apply">Slots full — join waitlist</Button>
              ) : canApply ? (
                <Button
                  onClick={() => applyMutation.mutate()}
                  disabled={applyMutation.isPending}
                  size="lg"
                  className="w-full md:w-auto"
                  data-testid="button-apply"
                >
                  {applyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Apply for {formatRupees(campaign.reward_amount)}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card className="border-card-border">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Requirements</h3>
            <ul className="space-y-2">
              {reqs.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Products */}
        <div>
          <h3 className="font-semibold mb-3">
            {canReserve ? "Pick a product to reserve your slot" : "Products in this campaign"}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaign.products?.map((p) => {
              const reserved = myApp?.product_id === p.id;
              return (
                <Card key={p.id} className={`border-card-border overflow-hidden ${reserved ? "ring-2 ring-primary" : ""}`}>
                  <div className="h-32 bg-muted">
                    {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <CardContent className="p-4">
                    <div className="font-medium mb-1 line-clamp-2 text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground mb-2">ID: <span className="font-mono">{p.asin_or_id}</span></div>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold tabular-nums">{formatRupees(p.price)}</div>
                      <a href={p.marketplace_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> View
                      </a>
                    </div>
                    {canReserve && (
                      <Button
                        size="sm"
                        variant={selectedProd === p.id ? "default" : "outline"}
                        className="w-full mt-3"
                        onClick={() => { setSelectedProd(p.id); reserveMutation.mutate(p.id); }}
                        disabled={reserveMutation.isPending}
                        data-testid={`button-reserve-${p.id}`}
                      >
                        {reserveMutation.isPending && selectedProd === p.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Reserve this
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </ReviewerLayout>
  );
}
