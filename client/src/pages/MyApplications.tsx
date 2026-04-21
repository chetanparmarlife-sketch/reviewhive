import { useQuery, useMutation } from "@tanstack/react-query";
import { ReviewerLayout } from "@/components/ReviewerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRupees, useSession, LIFECYCLE, statusMeta } from "@/lib/session";
import { MarketplaceBadge, StatusBadge } from "@/components/MarketplaceBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Hexagon, Upload, CheckCircle2, FileCheck2, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { queryClient, qk } from "@/lib/queryClient";
import { listApplicationsForUser, listCampaignsWithBrand, getCampaignDetail, updateOwnApplication } from "@/lib/db";
import { uploadProof } from "@/lib/uploads";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Application, Campaign } from "@shared/schema";

type AppWithCampaign = Application & { campaign?: Campaign };

export default function MyApplications() {
  const user = useSession();
  const { data: apps = [], isLoading } = useQuery<Application[]>({
    queryKey: qk.applicationsForUser(user?.id),
    queryFn: () => (user ? listApplicationsForUser(user.id) : Promise.resolve([])),
    enabled: !!user,
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: qk.reviewerCampaigns(user?.id),
    queryFn: listCampaignsWithBrand,
    enabled: !!user,
  });

  const appsEnriched: AppWithCampaign[] = apps.map(a => ({ ...a, campaign: campaigns.find(c => c.id === a.campaign_id) }))
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());

  const [open, setOpen] = useState<AppWithCampaign | null>(null);

  return (
    <ReviewerLayout title="My Applications">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My applications</h2>
          <p className="text-sm text-muted-foreground">Track each campaign from applied to paid.</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : appsEnriched.length === 0 ? (
          <Card className="border-card-border border-dashed">
            <CardContent className="p-10 text-center">
              <Hexagon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <div className="font-semibold">No applications yet</div>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Browse live campaigns and apply.</p>
              <Link href="/campaigns"><Button>Browse campaigns</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {appsEnriched.map(a => (
              <Card
                key={a.id}
                className="border-card-border hover-elevate cursor-pointer"
                onClick={() => setOpen(a)}
                data-testid={`card-application-${a.id}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                    {a.campaign?.cover_image_url && <img src={a.campaign.cover_image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                      <MarketplaceBadge marketplace={a.campaign?.marketplace ?? "amazon_in"} />
                      <span className="truncate">{a.campaign?.brand?.name ?? "—"}</span>
                    </div>
                    <div className="font-medium truncate">{a.campaign?.title}</div>
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-1 text-right">
                    <div className="text-primary font-bold tabular-nums">{formatRupees(a.campaign?.reward_amount ?? 0)}</div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="md:hidden flex flex-col items-end gap-1">
                    <div className="text-primary font-bold tabular-nums text-sm">{formatRupees(a.campaign?.reward_amount ?? 0)}</div>
                    <StatusBadge status={a.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" side="right">
          {open && <SubmissionDrawer app={open} onClose={() => setOpen(null)} />}
        </SheetContent>
      </Sheet>
    </ReviewerLayout>
  );
}

interface UploadPadProps {
  label: string;
  testId: string;
  uploaded: boolean;
  previewUrl: string | null;
  onFile: (file: File) => void;
  uploading: boolean;
}
function UploadPad({ label, testId, uploaded, previewUrl, onFile, uploading }: UploadPadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
        data-testid={`${testId}-input`}
      />
      <div
        className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer ${uploaded ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-border"}`}
        onClick={() => !uploading && inputRef.current?.click()}
        data-testid={testId}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </div>
        ) : uploaded ? (
          <div className="flex flex-col items-center gap-2">
            {previewUrl && <img src={previewUrl} alt="" className="h-20 rounded border border-border" />}
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <FileCheck2 className="h-4 w-4" /> Uploaded (tap to replace)
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <Upload className="h-5 w-5 mx-auto mb-1" />
            Click to upload (JPG/PNG/WEBP, max 5 MB)
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionDrawer({ app, onClose }: { app: AppWithCampaign; onClose: () => void }) {
  const user = useSession();
  const { toast } = useToast();
  const [orderId, setOrderId] = useState(app.order_id ?? "");
  const [reviewLink, setReviewLink] = useState(app.review_link ?? "");
  const [reviewText, setReviewText] = useState(app.review_text ?? "");
  const [orderProofUrl, setOrderProofUrl] = useState<string | null>(app.order_proof_url);
  const [reviewProofUrl, setReviewProofUrl] = useState<string | null>(app.review_proof_url);
  const [uploadingOrder, setUploadingOrder] = useState(false);
  const [uploadingReview, setUploadingReview] = useState(false);

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof updateOwnApplication>[1]) =>
      updateOwnApplication(app.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Updated" });
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const { data: campaignFull } = useQuery<Campaign | null>({
    queryKey: qk.campaign(app.campaign_id),
    queryFn: () => getCampaignDetail(app.campaign_id),
    enabled: !!app.campaign_id,
  });

  async function handleOrderUpload(file: File) {
    if (!user) return;
    setUploadingOrder(true);
    try {
      const res = await uploadProof("order-proofs", file, user.id);
      setOrderProofUrl(res.path);
      toast({ title: "Order screenshot uploaded" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally { setUploadingOrder(false); }
  }
  async function handleReviewUpload(file: File) {
    if (!user) return;
    setUploadingReview(true);
    try {
      const res = await uploadProof("review-proofs", file, user.id);
      setReviewProofUrl(res.path);
      toast({ title: "Review screenshot uploaded" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally { setUploadingReview(false); }
  }

  async function submitOrder() {
    if (!orderId || !orderProofUrl) {
      toast({ title: "Please enter order ID and upload a screenshot", variant: "destructive" });
      return;
    }
    patch.mutate({
      status: "purchased",
      order_id: orderId,
      order_proof_url: orderProofUrl,
    });
  }
  async function submitReview() {
    if (!reviewLink || !reviewText || !reviewProofUrl) {
      toast({ title: "Please complete all fields", variant: "destructive" });
      return;
    }
    patch.mutate({
      status: "submitted",
      review_link: reviewLink,
      review_text: reviewText,
      review_proof_url: reviewProofUrl,
    });
    setTimeout(onClose, 500);
  }

  const product = campaignFull?.products?.find((p) => p.id === app.product_id);
  const lifecycleIdx = LIFECYCLE.indexOf(app.status);

  return (
    <div className="p-1">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-muted-foreground">Application</div>
          <div className="font-bold text-lg">{app.campaign?.title}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-drawer"><X className="h-4 w-4" /></Button>
      </div>

      <div className="mb-5">
        <StatusBadge status={app.status} size="md" />
      </div>

      {/* Lifecycle progress */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-2">
          {LIFECYCLE.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full ${i <= lifecycleIdx ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          {LIFECYCLE.map((s, i) => (
            <div key={s} className={`${i <= lifecycleIdx ? "text-primary font-semibold" : ""} ${i === 0 ? "text-left" : i === LIFECYCLE.length - 1 ? "text-right" : "text-center"}`}>
              {statusMeta(s).label}
            </div>
          ))}
        </div>
      </div>

      {product && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border mb-5">
          <div className="h-12 w-12 rounded-md bg-background overflow-hidden flex-shrink-0">
            {product.image_url && <img src={product.image_url} className="h-full w-full object-cover" alt="" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{product.name}</div>
            <div className="text-xs text-muted-foreground">{formatRupees(product.price)} · {product.asin_or_id}</div>
          </div>
          <a href={product.marketplace_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Buy →</a>
        </div>
      )}

      {/* Step 1: Order info (after reserved) */}
      {["reserved", "purchased", "submitted", "verified", "paid"].includes(app.status) && (
        <div className="space-y-3 mb-5 p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 font-semibold">
            {app.order_id ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4" />}
            Step 1: Order proof
          </div>
          {app.status === "reserved" ? (
            <>
              <Label>Order ID (from marketplace)</Label>
              <Input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="171-XXXXXXX-XXXXXXX" data-testid="input-order-id" />
              <UploadPad
                label="Order screenshot"
                testId="upload-order"
                uploaded={!!orderProofUrl}
                previewUrl={null}
                onFile={handleOrderUpload}
                uploading={uploadingOrder}
              />
              <Button onClick={submitOrder} disabled={patch.isPending} className="w-full" data-testid="button-submit-order">
                {patch.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit order proof
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              <div><span className="text-foreground font-medium">Order ID:</span> <span className="font-mono">{app.order_id}</span></div>
              <div className="mt-1 text-emerald-600 text-xs">✓ Uploaded</div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Review submission */}
      {["purchased", "submitted", "verified", "paid"].includes(app.status) && (
        <div className="space-y-3 mb-5 p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 font-semibold">
            {app.review_link ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4" />}
            Step 2: Review submission
          </div>
          {app.status === "purchased" ? (
            <>
              <div>
                <Label>Review link (Amazon / Flipkart / Meesho)</Label>
                <Input value={reviewLink} onChange={e => setReviewLink(e.target.value)} placeholder="https://amazon.in/review/..." data-testid="input-review-link" />
              </div>
              <div>
                <Label>Review text</Label>
                <Textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={4} placeholder="Paste your full review text here…" data-testid="input-review-text" />
              </div>
              <UploadPad
                label="Review screenshot"
                testId="upload-review"
                uploaded={!!reviewProofUrl}
                previewUrl={null}
                onFile={handleReviewUpload}
                uploading={uploadingReview}
              />
              <Button onClick={submitReview} disabled={patch.isPending} className="w-full" data-testid="button-submit-review">
                {patch.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit review for verification
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground space-y-1">
              <div><span className="text-foreground font-medium">Link:</span> <a href={app.review_link ?? "#"} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{app.review_link}</a></div>
              <div className="mt-2 p-2 rounded bg-muted/50 text-xs italic">"{app.review_text}"</div>
              {["verified", "paid"].includes(app.status) && <div className="text-emerald-600 text-xs">✓ Verified by admin</div>}
            </div>
          )}
        </div>
      )}

      {/* Paid */}
      {app.status === "paid" && (
        <div className="p-4 rounded-lg border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
          <div className="font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Paid
          </div>
          <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
            {formatRupees(app.campaign?.reward_amount ?? 0)} credited to your UPI
          </div>
          {app.payout_utr && <div className="text-xs text-muted-foreground mt-1">UTR: <span className="font-mono">{app.payout_utr}</span></div>}
        </div>
      )}

      {(app.status === "rejected" || app.status === "rejected_submission") && (
        <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
          <div className="font-semibold text-destructive flex items-center gap-2">Not selected</div>
          <div className="text-sm text-muted-foreground mt-1">{app.rejection_reason ?? app.admin_notes ?? "We had limited slots this round. Please try another campaign."}</div>
        </div>
      )}
    </div>
  );
}
