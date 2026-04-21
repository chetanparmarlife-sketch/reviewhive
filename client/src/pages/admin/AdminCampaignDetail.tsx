import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketplaceBadge, StatusBadge } from "@/components/MarketplaceBadge";
import { Progress } from "@/components/ui/progress";
import { formatRupees } from "@/lib/session";
import { queryClient, qk } from "@/lib/queryClient";
import {
  getCampaignDetail,
  listAllApplications,
  listReviewerProfiles,
  approveApplication,
  rejectApplication,
  adminUpdateApplication,
  updateCampaign,
  triggerPayout,
} from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Application, Profile, CampaignStatus } from "@shared/schema";

export default function AdminCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const campaignId = id ?? "";
  const { toast } = useToast();

  const { data: campaign } = useQuery({
    queryKey: qk.campaign(campaignId),
    queryFn: () => getCampaignDetail(campaignId),
    enabled: !!campaignId,
  });

  const { data: apps = [] } = useQuery<Application[]>({
    queryKey: qk.applicationsForCampaign(campaignId),
    queryFn: () => listAllApplications({ campaignId }),
    enabled: !!campaignId,
  });

  const { data: users = [] } = useQuery<Profile[]>({
    queryKey: qk.reviewers,
    queryFn: listReviewerProfiles,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.applicationsForCampaign(campaignId) });
    queryClient.invalidateQueries({ queryKey: qk.campaign(campaignId) });
    queryClient.invalidateQueries({ queryKey: qk.applications });
  };

  const approve = useMutation({
    mutationFn: (appId: string) => approveApplication(appId),
    onSuccess: () => { invalidate(); toast({ title: "Application approved" }); },
    onError: (e: Error) => toast({ title: "Approve failed", description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: ({ appId, reason, stage }: { appId: string; reason: string; stage: "application" | "submission" }) =>
      rejectApplication(appId, reason, stage),
    onSuccess: () => { invalidate(); toast({ title: "Rejected" }); },
    onError: (e: Error) => toast({ title: "Reject failed", description: e.message, variant: "destructive" }),
  });

  const verify = useMutation({
    mutationFn: (appId: string) =>
      adminUpdateApplication(appId, { status: "verified", verified_at: new Date().toISOString() }),
    onSuccess: () => { invalidate(); toast({ title: "Submission verified" }); },
    onError: (e: Error) => toast({ title: "Verify failed", description: e.message, variant: "destructive" }),
  });

  const pay = useMutation({
    mutationFn: (appId: string) => triggerPayout(appId),
    onSuccess: (res) => {
      invalidate();
      toast({ title: res.mocked ? "Payout stubbed" : "Payout initiated", description: `UTR: ${res.utr}` });
    },
    onError: (e: Error) => toast({ title: "Payout failed", description: e.message, variant: "destructive" }),
  });

  const campaignMutation = useMutation({
    mutationFn: (patch: { status?: CampaignStatus }) => updateCampaign(campaignId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: qk.campaigns });
      toast({ title: "Campaign updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const handleReject = (appId: string, stage: "application" | "submission") => {
    const reason = window.prompt("Reason for rejection") ?? "";
    if (!reason.trim()) return;
    reject.mutate({ appId, reason, stage });
  };

  if (!campaign) return <AdminLayout><div className="p-6">Loading…</div></AdminLayout>;
  const pct = campaign.total_slots ? (campaign.slots_filled / campaign.total_slots) * 100 : 0;
  const products = (campaign as any).products ?? [];
  const brand = (campaign as any).brand;

  return (
    <AdminLayout title={campaign.title}>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <Link href="/admin/campaigns" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5" data-testid="link-back-campaigns">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>

        <Card className="border-card-border overflow-hidden">
          <div className="h-32 bg-muted relative">
            {campaign.cover_image_url && <img src={campaign.cover_image_url} className="w-full h-full object-cover" alt="" />}
          </div>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <MarketplaceBadge marketplace={campaign.marketplace} />
                  <StatusBadge status={campaign.status} />
                </div>
                <h1 className="text-xl font-bold" data-testid="text-campaign-title">{campaign.title}</h1>
                <div className="text-xs text-muted-foreground">{brand?.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Reward</div>
                <div className="text-xl font-bold text-primary tabular-nums" data-testid="text-reward">{formatRupees(campaign.reward_amount)}</div>
              </div>
            </div>
            <Progress value={pct} className="h-1.5" />
            <div className="text-xs text-muted-foreground mt-1 tabular-nums">{campaign.slots_filled}/{campaign.total_slots} slots filled</div>
          </CardContent>
        </Card>

        <Tabs defaultValue="applications">
          <TabsList>
            <TabsTrigger value="applications" data-testid="tab-applications">Applications ({apps.length})</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="mt-4">
            <Card className="border-card-border">
              <CardContent className="p-0">
                {apps.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground" data-testid="text-no-applications">No applications yet.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {apps.map(a => {
                      const u = users.find(uu => uu.id === a.user_id);
                      const busy = approve.isPending || reject.isPending || verify.isPending || pay.isPending;
                      return (
                        <div key={a.id} className="p-4 flex flex-wrap md:flex-nowrap items-center gap-3" data-testid={`row-application-${a.id}`}>
                          <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {u?.name?.[0] ?? "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm" data-testid={`text-reviewer-${a.id}`}>{u?.name ?? "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">Trust: {u?.trust_score ?? "—"}/100 · {u?.completed_campaigns ?? 0} done</div>
                          </div>
                          <StatusBadge status={a.status} />
                          <div className="flex gap-1.5">
                            {a.status === "applied" && (
                              <>
                                <Button size="sm" disabled={busy} onClick={() => approve.mutate(a.id)} data-testid={`button-approve-${a.id}`}>
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleReject(a.id, "application")} data-testid={`button-reject-${a.id}`}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {a.status === "submitted" && (
                              <>
                                <Button size="sm" disabled={busy} onClick={() => verify.mutate(a.id)} data-testid={`button-verify-${a.id}`}>
                                  Verify
                                </Button>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleReject(a.id, "submission")} data-testid={`button-reject-submission-${a.id}`}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {a.status === "verified" && (
                              <Button size="sm" disabled={busy} onClick={() => pay.mutate(a.id)} data-testid={`button-paid-${a.id}`}>
                                Mark paid
                              </Button>
                            )}
                            {a.status === "paid" && a.payout_utr && (
                              <span className="text-xs text-muted-foreground font-mono" data-testid={`text-utr-${a.id}`}>UTR: {a.payout_utr}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p: any) => (
                <Card key={p.id} className="border-card-border overflow-hidden" data-testid={`card-product-${p.id}`}>
                  <div className="h-24 bg-muted">
                    {p.image_url && <img src={p.image_url} className="h-full w-full object-cover" alt="" />}
                  </div>
                  <CardContent className="p-3">
                    <div className="font-medium text-sm line-clamp-1">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{formatRupees(p.price)} · {p.asin_or_id}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card className="border-card-border">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Campaign status</div>
                    <div className="text-xs text-muted-foreground">Change whether this campaign is visible to reviewers.</div>
                  </div>
                  <Select value={campaign.status} onValueChange={v => campaignMutation.mutate({ status: v as CampaignStatus })}>
                    <SelectTrigger className="w-40" data-testid="select-campaign-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
