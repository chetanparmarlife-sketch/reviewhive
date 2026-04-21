import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRupees } from "@/lib/session";
import { queryClient, qk } from "@/lib/queryClient";
import {
  listAllApplications,
  listReviewerProfiles,
  listCampaignsWithBrand,
  triggerPayout,
} from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { MarketplaceBadge } from "@/components/MarketplaceBadge";
import { Check, Loader2 } from "lucide-react";
import type { Application, Profile, Campaign } from "@shared/schema";

export default function AdminPayouts() {
  const { data: apps = [] } = useQuery<Application[]>({
    queryKey: qk.applications,
    queryFn: () => listAllApplications(),
  });
  const { data: users = [] } = useQuery<Profile[]>({
    queryKey: qk.reviewers,
    queryFn: listReviewerProfiles,
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: qk.campaigns,
    queryFn: listCampaignsWithBrand,
  });

  const pending = apps.filter(a => a.status === "verified");
  const paid = apps.filter(a => a.status === "paid");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const { toast } = useToast();

  const pay = useMutation({
    mutationFn: (appId: string) => triggerPayout(appId),
    onSuccess: (res, appId) => {
      queryClient.invalidateQueries({ queryKey: qk.applications });
      toast({
        title: res.mocked ? "Payout stubbed" : "Payout initiated",
        description: `App ${appId.slice(0, 8)} · UTR ${res.utr}`,
      });
    },
    onError: (e: Error) => toast({ title: "Payout failed", description: e.message, variant: "destructive" }),
  });

  async function batchPay() {
    setWorking(true);
    let success = 0;
    let failure = 0;
    for (const id of Array.from(selected)) {
      try {
        await pay.mutateAsync(id);
        success++;
      } catch {
        failure++;
      }
    }
    setWorking(false);
    setSelected(new Set());
    toast({
      title: `Processed ${success + failure} payout${success + failure === 1 ? "" : "s"}`,
      description: failure > 0 ? `${success} succeeded, ${failure} failed` : `${success} succeeded`,
    });
  }

  return (
    <AdminLayout title="Payouts">
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-payouts-heading">Payouts</h2>
          <p className="text-sm text-muted-foreground">{pending.length} awaiting payment · {paid.length} paid</p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="paid" data-testid="tab-paid">Paid ({paid.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {selected.size > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30 mb-3">
                <div className="text-sm"><span className="font-semibold">{selected.size}</span> selected</div>
                <Button onClick={batchPay} disabled={working} data-testid="button-batch-pay">
                  {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Trigger payouts
                </Button>
              </div>
            )}
            <Card className="border-card-border">
              <CardContent className="p-0">
                {pending.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground" data-testid="text-no-pending">All caught up. No pending payouts.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {pending.map(a => {
                      const u = users.find(uu => uu.id === a.user_id);
                      const c = campaigns.find(cc => cc.id === a.campaign_id);
                      const isSel = selected.has(a.id);
                      const rowBusy = working || pay.isPending;
                      return (
                        <div key={a.id} className="p-4 flex items-center gap-3" data-testid={`row-payout-${a.id}`}>
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={(v) => {
                              const next = new Set(selected);
                              if (v) next.add(a.id); else next.delete(a.id);
                              setSelected(next);
                            }}
                            data-testid={`checkbox-payout-${a.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{u?.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              {c && <MarketplaceBadge marketplace={c.marketplace} />}
                              <span className="truncate">{c?.title}</span>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">UPI: {u?.upi_id ?? "—"}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold tabular-nums text-primary">{formatRupees(c?.reward_amount ?? 0)}</div>
                          </div>
                          <Button
                            size="sm"
                            disabled={rowBusy}
                            onClick={() => pay.mutate(a.id)}
                            data-testid={`button-pay-${a.id}`}
                          >
                            {pay.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paid" className="mt-4">
            <Card className="border-card-border">
              <CardContent className="p-0">
                {paid.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">No payouts yet.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {paid.map(a => {
                      const u = users.find(uu => uu.id === a.user_id);
                      const c = campaigns.find(cc => cc.id === a.campaign_id);
                      return (
                        <div key={a.id} className="p-4 flex items-center gap-3" data-testid={`row-paid-${a.id}`}>
                          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                            <Check className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{u?.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{c?.title}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold tabular-nums">{formatRupees(c?.reward_amount ?? 0)}</div>
                            {a.payout_utr && <div className="text-[10px] font-mono text-muted-foreground">UTR {a.payout_utr}</div>}
                            {a.paid_at && <div className="text-[10px] text-muted-foreground">{new Date(a.paid_at).toLocaleDateString("en-IN")}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
