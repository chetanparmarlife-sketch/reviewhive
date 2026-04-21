import { useQuery } from "@tanstack/react-query";
import { ReviewerLayout } from "@/components/ReviewerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, formatRupees } from "@/lib/session";
import { Award, Mail, Phone, Wallet, Calendar } from "lucide-react";
import { qk } from "@/lib/queryClient";
import { getProfile, listApplicationsForUser, listCampaignsWithBrand } from "@/lib/db";
import type { Profile as ProfileType, Application, Campaign } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

export default function Profile() {
  const user = useSession();
  const { data: fullUser } = useQuery<ProfileType | null>({
    queryKey: qk.profile(user?.id),
    queryFn: () => (user ? getProfile(user.id) : Promise.resolve(null)),
    enabled: !!user,
  });
  const { data: apps = [] } = useQuery<Application[]>({
    queryKey: qk.applicationsForUser(user?.id),
    queryFn: () => (user ? listApplicationsForUser(user.id) : Promise.resolve([])),
    enabled: !!user,
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: qk.reviewerCampaigns(user?.id),
    queryFn: listCampaignsWithBrand,
    enabled: !!user,
  });

  const u = fullUser ?? user;
  if (!u) return null;

  const badge = u.trust_score >= 90 ? { label: "Gold Reviewer", color: "bg-amber-500 text-white" } :
    u.trust_score >= 75 ? { label: "Silver Reviewer", color: "bg-slate-400 text-white" } :
    { label: "Bronze Reviewer", color: "bg-orange-700 text-white" };

  return (
    <ReviewerLayout title="Profile">
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {/* Header card */}
        <Card className="border-card-border overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-primary/30 to-primary/10 relative">
            <div className="absolute inset-0 honeycomb-bg opacity-40" />
          </div>
          <CardContent className="p-5 pt-0 -mt-10">
            <div className="flex items-end gap-4 mb-4">
              <Avatar className="h-20 w-20 border-4 border-background ring-1 ring-border">
                {u.avatar_url ? <AvatarImage src={u.avatar_url} /> : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{u.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 pb-2">
                <h1 className="text-xl font-bold" data-testid="text-profile-name">{u.name}</h1>
                <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                  <Award className="h-3 w-3" /> {badge.label}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 pt-3 border-t border-border">
              <div>
                <div className="text-xs text-muted-foreground">Trust score</div>
                <div className="text-2xl font-bold text-primary tabular-nums">{u.trust_score}<span className="text-sm text-muted-foreground">/100</span></div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Campaigns done</div>
                <div className="text-2xl font-bold tabular-nums">{u.completed_campaigns}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total earned</div>
                <div className="text-2xl font-bold tabular-nums">{formatRupees(u.total_earnings)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact info */}
        <Card className="border-card-border">
          <CardContent className="p-5 space-y-3">
            <div className="font-semibold mb-2">Contact info</div>
            <InfoRow icon={Mail} label="Email" value={u.email} />
            <InfoRow icon={Phone} label="Phone" value={u.phone ?? "—"} />
            <InfoRow icon={Wallet} label="UPI ID" value={u.upi_id ?? "Not set"} mono />
            <InfoRow icon={Calendar} label="Member since" value={u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—"} />
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="border-card-border">
          <CardContent className="p-0">
            <div className="p-5 pb-3 font-semibold">Recent activity</div>
            <div className="divide-y divide-border">
              {apps.slice(0, 5).map(a => {
                const c = campaigns.find(cc => cc.id === a.campaign_id);
                return (
                  <div key={a.id} className="p-4 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">{c?.title ?? "Campaign"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(a.applied_at).toLocaleDateString("en-IN")}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{a.status}</span>
                  </div>
                );
              })}
              {apps.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No activity yet</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </ReviewerLayout>
  );
}

interface InfoRowProps { icon: LucideIcon; label: string; value: string; mono?: boolean }
function InfoRow({ icon: Icon, label, value, mono }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="text-xs text-muted-foreground w-24">{label}</div>
      <div className={`text-sm flex-1 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
