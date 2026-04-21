import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { formatRupees } from "@/lib/session";
import { Megaphone, Inbox, Wallet2, Users, CheckCircle2, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { MarketplaceBadge, StatusBadge } from "@/components/MarketplaceBadge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { fetchAdminStats, listAllApplications, adminListCampaigns, listReviewerProfiles, type StatsResponse } from "@/lib/db";
import { qk } from "@/lib/queryClient";
import type { Application, Campaign, Profile } from "@shared/schema";

export default function AdminDashboard() {
  const { data: stats } = useQuery<StatsResponse>({ queryKey: qk.stats, queryFn: fetchAdminStats });
  const { data: apps = [] } = useQuery<Application[]>({ queryKey: qk.applications, queryFn: () => listAllApplications() });
  const { data: campaigns = [] } = useQuery<Campaign[]>({ queryKey: qk.campaigns, queryFn: adminListCampaigns });
  const { data: users = [] } = useQuery<Profile[]>({ queryKey: qk.reviewers, queryFn: listReviewerProfiles });

  const recent = [...apps]
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
    .slice(0, 10);

  const kpis = [
    { label: "Active campaigns", value: stats?.activeCampaigns ?? "—", icon: Megaphone, color: "text-primary bg-primary/15" },
    { label: "Live applications", value: stats?.liveApplications ?? "—", icon: TrendingUp, color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-950" },
    { label: "Pending verifications", value: stats?.pendingVerifications ?? "—", icon: Inbox, color: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
    { label: "Pending payouts", value: stats?.pendingPayouts ?? "—", icon: Wallet2, color: "text-violet-600 bg-violet-100 dark:bg-violet-950" },
    { label: "Paid this month", value: stats ? formatRupees(stats.paidThisMonth) : "—", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950", sub: stats ? `${stats.paidCountThisMonth} payouts` : "" },
    { label: "Total reviewers", value: stats?.totalReviewers ?? "—", icon: Users, color: "text-rose-600 bg-rose-100 dark:bg-rose-950" },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Today at ReviewHive.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <Card key={k.label} className="border-card-border">
                <CardContent className="p-4">
                  <div className={`h-8 w-8 rounded-md flex items-center justify-center ${k.color} mb-3`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</div>
                  <div className="text-xl font-bold tabular-nums" data-testid={`kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`}>{k.value}</div>
                  {k.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Chart */}
        <Card className="border-card-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Applications — last 30 days</div>
                <div className="text-xs text-muted-foreground">Daily application volume</div>
              </div>
            </div>
            <div className="h-48 -mx-2">
              {stats?.perDay && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.perDay}>
                    <defs>
                      <linearGradient id="colorApp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).getDate().toString()} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="count" stroke="hsl(38, 92%, 50%)" strokeWidth={2} fill="url(#colorApp)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-card-border md:col-span-2">
            <CardContent className="p-0">
              <div className="p-5 pb-3 flex items-center justify-between">
                <div className="font-semibold">Recent applications</div>
                <Link href="/admin/submissions"><Button variant="ghost" size="sm">View all</Button></Link>
              </div>
              <div className="divide-y divide-border">
                {recent.map(a => {
                  const c = campaigns.find(cc => cc.id === a.campaign_id);
                  const u = users.find(uu => uu.id === a.user_id);
                  return (
                    <div key={a.id} className="p-4 flex items-center gap-3 text-sm">
                      <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {u?.name?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate"><span className="font-medium">{u?.name ?? "Unknown"}</span> · {c?.title ?? "—"}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {c && <MarketplaceBadge marketplace={c.marketplace} />}
                          <span>{new Date(a.applied_at).toLocaleDateString("en-IN")}</span>
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  );
                })}
                {recent.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No applications yet</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardContent className="p-5">
              <div className="font-semibold mb-3">Quick actions</div>
              <div className="space-y-2">
                <Link href="/admin/campaigns"><Button variant="outline" className="w-full justify-start">+ New campaign</Button></Link>
                <Link href="/admin/submissions"><Button variant="outline" className="w-full justify-start">Review submissions ({stats?.pendingVerifications ?? 0})</Button></Link>
                <Link href="/admin/payouts"><Button variant="outline" className="w-full justify-start">Process payouts ({stats?.pendingPayouts ?? 0})</Button></Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
