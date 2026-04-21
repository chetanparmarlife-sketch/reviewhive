import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/session";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Search, Award, Ban, Check } from "lucide-react";
import { StatusBadge } from "@/components/MarketplaceBadge";
import {
  listReviewerProfiles,
  listAllApplications,
  listCampaignsWithBrand,
  adminUpdateProfile,
} from "@/lib/db";
import { queryClient, qk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Profile, Application, Campaign } from "@shared/schema";

type Enriched = Profile & { totalApps: number; paidApps: number; completion: number };

export default function AdminUsers() {
  const { data: users = [] } = useQuery<Profile[]>({
    queryKey: qk.reviewers,
    queryFn: listReviewerProfiles,
  });
  const { data: apps = [] } = useQuery<Application[]>({
    queryKey: qk.applications,
    queryFn: () => listAllApplications(),
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: qk.campaigns,
    queryFn: listCampaignsWithBrand,
  });

  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Enriched | null>(null);

  const enriched: Enriched[] = useMemo(() => users.map(u => {
    const userApps = apps.filter(a => a.user_id === u.id);
    const paid = userApps.filter(a => a.status === "paid").length;
    const total = userApps.length;
    return { ...u, totalApps: total, paidApps: paid, completion: total > 0 ? Math.round(paid / total * 100) : 0 };
  }), [users, apps]);

  const filtered = enriched.filter(u => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return u.name.toLowerCase().includes(needle) || (u.email ?? "").toLowerCase().includes(needle);
  });

  const toggleBlock = useMutation({
    mutationFn: ({ id, is_blocked }: { id: string; is_blocked: boolean }) =>
      adminUpdateProfile(id, { is_blocked }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: qk.reviewers });
      toast({ title: updated.is_blocked ? "User blocked" : "User unblocked" });
      setSelected(prev => prev ? { ...prev, is_blocked: updated.is_blocked } : prev);
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout title="Reviewers">
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-users-heading">Reviewers</h2>
          <p className="text-sm text-muted-foreground">{users.length} registered</p>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search reviewers…" value={q} onChange={e => setQ(e.target.value)} className="pl-10" data-testid="input-search-users" />
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="w-full text-left p-4 flex items-center gap-3 hover-elevate"
                  data-testid={`button-user-${u.id}`}
                >
                  <Avatar className="h-10 w-10">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{u.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {u.name}
                      {u.is_blocked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-semibold">BLOCKED</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="hidden md:block text-right">
                    <div className="text-xs text-muted-foreground">Earned</div>
                    <div className="font-semibold tabular-nums text-primary">{formatRupees(u.total_earnings ?? 0)}</div>
                  </div>
                  <div className="hidden md:block text-right">
                    <div className="text-xs text-muted-foreground">Completion</div>
                    <div className="font-semibold tabular-nums">{u.completion}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Trust</div>
                    <div className="font-semibold tabular-nums">{u.trust_score ?? 0}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground" data-testid="text-no-users">No reviewers match your search.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <div className="p-1 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {selected.avatar_url && <AvatarImage src={selected.avatar_url} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{selected.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-bold text-lg flex items-center gap-2">
                    {selected.name}
                    {selected.is_blocked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-semibold">BLOCKED</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{selected.email}</div>
                </div>
                <Button
                  variant={selected.is_blocked ? "default" : "destructive"}
                  size="sm"
                  disabled={toggleBlock.isPending}
                  onClick={() => toggleBlock.mutate({ id: selected.id, is_blocked: !selected.is_blocked })}
                  data-testid="button-toggle-block"
                >
                  {selected.is_blocked ? <><Check className="h-3.5 w-3.5 mr-1" /> Unblock</> : <><Ban className="h-3.5 w-3.5 mr-1" /> Block</>}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="text-xs text-muted-foreground">Earned</div>
                  <div className="font-bold text-primary tabular-nums">{formatRupees(selected.total_earnings ?? 0)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="text-xs text-muted-foreground">Done</div>
                  <div className="font-bold tabular-nums">{selected.completed_campaigns ?? 0}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><Award className="h-3 w-3" /> Trust</div>
                  <div className="font-bold tabular-nums">{selected.trust_score ?? 0}</div>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-2 text-sm">Application history</div>
                <div className="space-y-1.5">
                  {apps.filter(a => a.user_id === selected.id).map(a => {
                    const c = campaigns.find(cc => cc.id === a.campaign_id);
                    return (
                      <div key={a.id} className="p-2.5 rounded-md border border-border flex items-center gap-2 text-sm" data-testid={`row-history-${a.id}`}>
                        <div className="flex-1 truncate">{c?.title}</div>
                        <StatusBadge status={a.status} />
                      </div>
                    );
                  })}
                  {apps.filter(a => a.user_id === selected.id).length === 0 && (
                    <div className="text-xs text-muted-foreground">No applications yet.</div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                Phone: {selected.phone ?? "—"} · UPI: <span className="font-mono">{selected.upi_id ?? "—"}</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
