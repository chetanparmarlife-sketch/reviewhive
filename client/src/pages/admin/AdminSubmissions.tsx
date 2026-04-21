import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarketplaceBadge } from "@/components/MarketplaceBadge";
import { queryClient, qk } from "@/lib/queryClient";
import {
  listAllApplications,
  listReviewerProfiles,
  listCampaignsWithBrand,
  adminUpdateApplication,
  rejectApplication,
  createSignedUrl,
} from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Check, X, ExternalLink, Inbox, Loader2 } from "lucide-react";
import { formatRupees } from "@/lib/session";
import type { Application, Profile, Campaign } from "@shared/schema";

interface OpenState {
  app: Application;
  user: Profile | undefined;
  campaign: Campaign | undefined;
}

export default function AdminSubmissions() {
  const { data: apps = [] } = useQuery<Application[]>({
    queryKey: qk.applicationsByStatus("submitted"),
    queryFn: () => listAllApplications({ status: "submitted" }),
  });
  const { data: users = [] } = useQuery<Profile[]>({
    queryKey: qk.reviewers,
    queryFn: listReviewerProfiles,
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: qk.campaigns,
    queryFn: listCampaignsWithBrand,
  });
  const [open, setOpen] = useState<OpenState | null>(null);

  return (
    <AdminLayout title="Submissions">
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-submissions-heading">Submissions inbox</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-submissions-count">{apps.length} submissions awaiting verification</p>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            {apps.length === 0 ? (
              <div className="p-12 text-center" data-testid="text-empty-submissions">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <div className="font-semibold">Inbox zero!</div>
                <p className="text-sm text-muted-foreground mt-1">All submissions verified.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {apps.map(a => {
                  const u = users.find(uu => uu.id === a.user_id);
                  const c = campaigns.find(cc => cc.id === a.campaign_id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => setOpen({ app: a, user: u, campaign: c })}
                      className="w-full text-left p-4 flex items-center gap-3 hover-elevate"
                      data-testid={`button-submission-${a.id}`}
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {u?.name?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{u?.name}</div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                          {c && <MarketplaceBadge marketplace={c.marketplace} />}
                          <span className="truncate">{c?.title}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{formatRupees(c?.reward_amount ?? 0)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-IN") : "—"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {open && <SubmissionReview data={open} onClose={() => setOpen(null)} />}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}

function SubmissionReview({ data, onClose }: { data: OpenState; onClose: () => void }) {
  const { app, user, campaign } = data;
  const { toast } = useToast();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [orderProofUrl, setOrderProofUrl] = useState<string | null>(null);
  const [reviewProofUrl, setReviewProofUrl] = useState<string | null>(null);

  // Generate signed URLs for private proof images on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (app.order_proof_url) {
        const url = await createSignedUrl("order-proofs", app.order_proof_url, 3600);
        if (!cancelled) setOrderProofUrl(url);
      }
      if (app.review_proof_url) {
        const url = await createSignedUrl("review-proofs", app.review_proof_url, 3600);
        if (!cancelled) setReviewProofUrl(url);
      }
    })();
    return () => { cancelled = true; };
  }, [app.id, app.order_proof_url, app.review_proof_url]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.applications });
    queryClient.invalidateQueries({ queryKey: qk.applicationsByStatus("submitted") });
    queryClient.invalidateQueries({ queryKey: qk.applicationsByStatus("verified") });
  };

  const verify = useMutation({
    mutationFn: () => adminUpdateApplication(app.id, { status: "verified", verified_at: new Date().toISOString() }),
    onSuccess: () => { invalidate(); toast({ title: "Submission verified" }); onClose(); },
    onError: (e: Error) => toast({ title: "Verify failed", description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: (reason: string) => rejectApplication(app.id, reason, "submission"),
    onSuccess: () => { invalidate(); toast({ title: "Submission rejected" }); onClose(); },
    onError: (e: Error) => toast({ title: "Reject failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-1">
      <div className="mb-4">
        <div className="text-xs text-muted-foreground">Submission from</div>
        <div className="font-bold text-lg" data-testid="text-reviewer-name">{user?.name}</div>
        <div className="text-xs text-muted-foreground">Trust {user?.trust_score ?? 0}/100 · {user?.completed_campaigns ?? 0} completed</div>
      </div>

      <div className="p-3 rounded-lg border border-border bg-muted/40 mb-4">
        <div className="flex items-center gap-2 mb-1">
          {campaign && <MarketplaceBadge marketplace={campaign.marketplace} />}
        </div>
        <div className="font-medium text-sm">{campaign?.title}</div>
        <div className="text-xs text-muted-foreground">Reward: {formatRupees(campaign?.reward_amount ?? 0)}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-xs font-semibold mb-1">Order proof</div>
          <a
            href={orderProofUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="block aspect-[4/3] rounded-lg border border-border bg-muted overflow-hidden hover-elevate"
            data-testid="link-order-proof"
          >
            {orderProofUrl && <img src={orderProofUrl} className="w-full h-full object-cover" alt="Order" />}
          </a>
          <div className="text-xs text-muted-foreground mt-1 font-mono">{app.order_id}</div>
        </div>
        <div>
          <div className="text-xs font-semibold mb-1">Review proof</div>
          <a
            href={reviewProofUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="block aspect-[4/3] rounded-lg border border-border bg-muted overflow-hidden hover-elevate"
            data-testid="link-review-proof"
          >
            {reviewProofUrl && <img src={reviewProofUrl} className="w-full h-full object-cover" alt="Review" />}
          </a>
          {app.review_link && (
            <a href={app.review_link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1" data-testid="link-review">
              <ExternalLink className="h-3 w-3" /> Open review
            </a>
          )}
        </div>
      </div>

      {app.review_text && (
        <div className="p-3 rounded-lg border border-border mb-4">
          <div className="text-xs font-semibold mb-1">Review text</div>
          <div className="text-sm italic" data-testid="text-review">"{app.review_text}"</div>
        </div>
      )}

      {!showReject ? (
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => verify.mutate()}
            disabled={verify.isPending}
            data-testid="button-approve-submission"
          >
            {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Verify & approve
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setShowReject(true)} data-testid="button-reject-submission">
            <X className="h-4 w-4 mr-2" /> Reject
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            placeholder="Reason for rejection (shown to reviewer)…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            data-testid="textarea-reject-reason"
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => reject.mutate(rejectReason)}
              disabled={!rejectReason.trim() || reject.isPending}
              data-testid="button-confirm-reject"
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm rejection
            </Button>
            <Button variant="outline" onClick={() => setShowReject(false)} data-testid="button-cancel-reject">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
