import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ReviewerLayout } from "@/components/ReviewerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupees, useSession, setSessionUser } from "@/lib/session";
import { MarketplaceBadge } from "@/components/MarketplaceBadge";
import { queryClient, qk } from "@/lib/queryClient";
import { listApplicationsForUser, listCampaignsWithBrand, getProfile, updateProfile } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { Wallet as WalletIcon, Check, Edit2, Loader2 } from "lucide-react";
import type { Application, Campaign, Profile } from "@shared/schema";

export default function Wallet() {
  const user = useSession();
  const { toast } = useToast();

  const { data: apps = [] } = useQuery<Application[]>({
    queryKey: qk.applicationsForUser(user?.id),
    queryFn: () => (user ? listApplicationsForUser(user.id) : Promise.resolve([])),
    enabled: !!user,
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: qk.campaigns,
    queryFn: listCampaignsWithBrand,
  });
  const { data: fullUser } = useQuery<Profile | null>({
    queryKey: qk.profile(user?.id),
    queryFn: () => (user ? getProfile(user.id) : Promise.resolve(null)),
    enabled: !!user,
  });

  const paid = apps.filter(a => a.status === "paid");
  const pending = apps.filter(a => ["submitted", "verified"].includes(a.status));
  const totalEarned = paid.reduce((s, a) => s + (campaigns.find(c => c.id === a.campaign_id)?.reward_amount ?? 0), 0);
  const pendingPayout = pending.reduce((s, a) => s + (campaigns.find(c => c.id === a.campaign_id)?.reward_amount ?? 0), 0);

  const [editUpi, setEditUpi] = useState(false);
  const [upi, setUpi] = useState(fullUser?.upi_id ?? "");
  useEffect(() => { if (fullUser?.upi_id) setUpi(fullUser.upi_id); }, [fullUser]);

  const saveUpi = useMutation({
    mutationFn: () => updateProfile(user!.id, { upi_id: upi }),
    onSuccess: (u) => {
      setSessionUser(u);
      queryClient.invalidateQueries({ queryKey: qk.profile(user!.id) });
      setEditUpi(false);
      toast({ title: "UPI ID saved" });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  return (
    <ReviewerLayout title="Wallet">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Wallet</h2>
          <p className="text-sm text-muted-foreground">Your earnings, payouts, and UPI settings.</p>
        </div>

        {/* Summary cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="border-card-border bg-primary/5 border-primary/30">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Total earned</div>
              <div className="text-3xl font-bold text-primary tabular-nums mt-1" data-testid="text-total-earned">{formatRupees(totalEarned)}</div>
              <div className="text-xs text-muted-foreground mt-1">{paid.length} payouts</div>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Pending</div>
              <div className="text-3xl font-bold tabular-nums mt-1" data-testid="text-pending-payout">{formatRupees(pendingPayout)}</div>
              <div className="text-xs text-muted-foreground mt-1">{pending.length} in review</div>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Campaigns done</div>
              <div className="text-3xl font-bold tabular-nums mt-1">{paid.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Trust score: {fullUser?.trust_score ?? 80}/100</div>
            </CardContent>
          </Card>
        </div>

        {/* UPI ID */}
        <Card className="border-card-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">UPI ID</div>
                <div className="text-xs text-muted-foreground">Payouts are sent to this UPI ID within 48 hours of review verification.</div>
              </div>
              {!editUpi && (
                <Button variant="outline" size="sm" onClick={() => setEditUpi(true)} data-testid="button-edit-upi">
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              )}
            </div>
            {editUpi ? (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>UPI ID</Label>
                  <Input value={upi} onChange={e => setUpi(e.target.value)} placeholder="yourname@okhdfcbank" data-testid="input-upi" />
                </div>
                <Button onClick={() => saveUpi.mutate()} disabled={saveUpi.isPending} data-testid="button-save-upi">
                  {saveUpi.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border font-mono text-sm">
                <WalletIcon className="h-4 w-4 text-primary" />
                {fullUser?.upi_id ?? "Not set"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payout history */}
        <Card className="border-card-border">
          <CardContent className="p-0">
            <div className="p-5 pb-3">
              <div className="font-semibold">Payout history</div>
            </div>
            {paid.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No payouts yet. Complete a review to get paid.</div>
            ) : (
              <div className="divide-y divide-border">
                {paid.map(a => {
                  const c = campaigns.find(cc => cc.id === a.campaign_id);
                  return (
                    <div key={a.id} className="p-4 flex items-center gap-4" data-testid={`row-payout-${a.id}`}>
                      <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex-shrink-0">
                        {c?.cover_image_url && <img src={c.cover_image_url} className="h-full w-full object-cover" alt="" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{c?.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <MarketplaceBadge marketplace={c?.marketplace ?? "amazon_in"} />
                          {a.paid_at && <span>{new Date(a.paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums text-primary">{formatRupees(c?.reward_amount ?? 0)}</div>
                        {a.payout_utr && <div className="text-[10px] text-muted-foreground font-mono">UTR {a.payout_utr}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ReviewerLayout>
  );
}
