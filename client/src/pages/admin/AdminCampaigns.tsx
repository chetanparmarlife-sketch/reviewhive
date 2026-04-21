import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { MarketplaceBadge, StatusBadge } from "@/components/MarketplaceBadge";
import { formatRupees, useSession } from "@/lib/session";
import { Progress } from "@/components/ui/progress";
import { queryClient, qk } from "@/lib/queryClient";
import { adminListCampaigns, listBrands, createCampaignWithProducts } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import type { Brand, Campaign, Marketplace, CampaignStatus } from "@shared/schema";

export default function AdminCampaigns() {
  const { data: campaigns = [] } = useQuery<Campaign[]>({ queryKey: qk.campaigns, queryFn: adminListCampaigns });
  const [open, setOpen] = useState(false);

  return (
    <AdminLayout title="Campaigns">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
            <p className="text-sm text-muted-foreground">{campaigns.length} total · {campaigns.filter(c => c.status === "live").length} live</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5" data-testid="button-new-campaign"><Plus className="h-4 w-4" /> New campaign</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <NewCampaignWizard onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {campaigns.map((c) => {
                const pct = (c.slots_filled / c.total_slots) * 100;
                return (
                  <Link key={c.id} href={`/admin/campaigns/${c.id}`}>
                    <div className="p-4 flex items-center gap-4 hover-elevate cursor-pointer" data-testid={`row-admin-campaign-${c.id}`}>
                      <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex-shrink-0">
                        {c.cover_image_url && <img src={c.cover_image_url} className="h-full w-full object-cover" alt="" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <MarketplaceBadge marketplace={c.marketplace} />
                          <StatusBadge status={c.status} />
                          <span className="text-xs text-muted-foreground">· {c.brand?.name}</span>
                        </div>
                        <div className="font-medium truncate">{c.title}</div>
                      </div>
                      <div className="hidden md:block w-40">
                        <div className="text-xs text-muted-foreground tabular-nums mb-1">{c.slots_filled}/{c.total_slots} slots</div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Reward × slots</div>
                        <div className="font-semibold tabular-nums">{formatRupees(c.reward_amount * c.total_slots)}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {campaigns.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No campaigns yet. Create your first one.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

interface WizardProduct {
  name: string;
  asin_or_id: string;
  marketplace_url: string;
  price: number;
  image_url: string | null;
  position: number;
}

function NewCampaignWizard({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const me = useSession();
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: qk.brands, queryFn: listBrands });
  const [step, setStep] = useState(1);

  const [data, setData] = useState({
    brand_id: "",
    title: "",
    description: "",
    marketplace: "amazon_in" as Marketplace,
    category: "Other",
    reward_amount: 500,
    total_slots: 30,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    requirements: [] as string[],
    newReq: "",
    products: [] as WizardProduct[],
    status: "live" as CampaignStatus,
  });

  const [newProd, setNewProd] = useState({ name: "", asin_or_id: "", marketplace_url: "", price: 0 });

  function coverSvg(title: string): string {
    return "data:image/svg+xml;utf8," + encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f59e0b'/><stop offset='1' stop-color='#d97706'/></linearGradient></defs><rect width='600' height='300' fill='url(#g)'/><text x='40' y='170' font-family='system-ui,sans-serif' font-size='28' font-weight='700' fill='white'>${title.slice(0, 30)}</text></svg>`
    );
  }
  function productSvg(name: string): string {
    return "data:image/svg+xml;utf8," + encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect fill='#fef3c7' width='400' height='300'/><text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' font-size='18' fill='#2a1e10'>${name.slice(0, 22)}</text></svg>`
    );
  }

  const create = useMutation({
    mutationFn: async () => {
      return createCampaignWithProducts(
        {
          brand_id: data.brand_id,
          title: data.title,
          description: data.description,
          marketplace: data.marketplace,
          category: data.category,
          reward_amount: data.reward_amount,
          total_slots: data.total_slots,
          start_date: new Date(data.start_date).toISOString(),
          end_date: new Date(data.end_date).toISOString(),
          requirements: data.requirements,
          status: data.status,
          cover_image_url: coverSvg(data.title),
          created_by: me?.id ?? null,
        },
        data.products.map((p, i) => ({
          name: p.name,
          asin_or_id: p.asin_or_id,
          marketplace_url: p.marketplace_url,
          price: p.price,
          image_url: productSvg(p.name),
          position: i,
        })),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.campaigns });
      toast({ title: "Campaign created", description: "Now live for reviewers" });
      onDone();
    },
    onError: (err: Error) => toast({ title: "Create failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div>
      <DialogHeader>
        <DialogTitle>New campaign · Step {step} of 4</DialogTitle>
        <DialogDescription>Create a new review campaign for one of your brands.</DialogDescription>
      </DialogHeader>
      <div className="mt-4">
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <Label>Brand</Label>
              <Select value={data.brand_id} onValueChange={v => setData({ ...data, brand_id: v })}>
                <SelectTrigger data-testid="select-brand"><SelectValue placeholder="Choose a brand" /></SelectTrigger>
                <SelectContent>
                  {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Campaign title</Label><Input value={data.title} onChange={e => setData({ ...data, title: e.target.value })} data-testid="input-campaign-title" /></div>
            <div><Label>Description</Label><Textarea value={data.description} onChange={e => setData({ ...data, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Marketplace</Label>
                <Select value={data.marketplace} onValueChange={v => setData({ ...data, marketplace: v as Marketplace })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amazon_in">Amazon India</SelectItem>
                    <SelectItem value="flipkart">Flipkart</SelectItem>
                    <SelectItem value="meesho">Meesho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Category</Label><Input value={data.category} onChange={e => setData({ ...data, category: e.target.value })} /></div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <div className="font-semibold">Products</div>
            <div className="space-y-2">
              {data.products.map((p, i) => (
                <div key={i} className="p-3 rounded-md border border-border flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{formatRupees(p.price)} · {p.asin_or_id}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setData({ ...data, products: data.products.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-md border border-dashed border-border space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} />
                <Input placeholder="ASIN / ID" value={newProd.asin_or_id} onChange={e => setNewProd({ ...newProd, asin_or_id: e.target.value })} />
                <Input placeholder="Marketplace URL" value={newProd.marketplace_url} onChange={e => setNewProd({ ...newProd, marketplace_url: e.target.value })} className="col-span-2" />
                <Input placeholder="Price (₹)" type="number" value={newProd.price || ""} onChange={e => setNewProd({ ...newProd, price: Number(e.target.value) })} />
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                if (!newProd.name) return;
                setData({ ...data, products: [...data.products, { ...newProd, image_url: null, position: data.products.length }] });
                setNewProd({ name: "", asin_or_id: "", marketplace_url: "", price: 0 });
              }}>+ Add product</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Reward (₹)</Label><Input type="number" value={data.reward_amount} onChange={e => setData({ ...data, reward_amount: Number(e.target.value) })} data-testid="input-reward" /></div>
              <div><Label>Total slots</Label><Input type="number" value={data.total_slots} onChange={e => setData({ ...data, total_slots: Number(e.target.value) })} /></div>
              <div><Label>Start date</Label><Input type="date" value={data.start_date} onChange={e => setData({ ...data, start_date: e.target.value })} /></div>
              <div><Label>End date</Label><Input type="date" value={data.end_date} onChange={e => setData({ ...data, end_date: e.target.value })} /></div>
            </div>
            <div>
              <Label>Requirements</Label>
              <div className="space-y-1.5 mb-2">
                {data.requirements.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 rounded border border-border">
                    <span className="flex-1">{r}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setData({ ...data, requirements: data.requirements.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add a requirement…" value={data.newReq} onChange={e => setData({ ...data, newReq: e.target.value })} onKeyDown={e => { if (e.key === "Enter" && data.newReq) { setData({ ...data, requirements: [...data.requirements, data.newReq], newReq: "" }); e.preventDefault(); } }} />
                <Button variant="outline" onClick={() => { if (data.newReq) { setData({ ...data, requirements: [...data.requirements, data.newReq], newReq: "" }); } }}>Add</Button>
              </div>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-3 text-sm">
            <div className="font-semibold text-lg">Review & publish</div>
            <Card className="border-card-border">
              <CardContent className="p-4 space-y-2">
                <Row l="Brand" v={brands.find(b => b.id === data.brand_id)?.name ?? "—"} />
                <Row l="Title" v={data.title} />
                <Row l="Marketplace" v={data.marketplace} />
                <Row l="Reward" v={formatRupees(data.reward_amount)} />
                <Row l="Slots" v={String(data.total_slots)} />
                <Row l="Products" v={`${data.products.length}`} />
                <Row l="Requirements" v={`${data.requirements.length}`} />
              </CardContent>
            </Card>
            <div>
              <Label>Status on publish</Label>
              <Select value={data.status} onValueChange={v => setData({ ...data, status: v as CampaignStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live now</SelectItem>
                  <SelectItem value="draft">Save as draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)} data-testid="button-wizard-next">
            Next <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button onClick={() => create.mutate()} disabled={create.isPending || !data.title || !data.brand_id} data-testid="button-wizard-publish">
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Publish campaign
          </Button>
        )}
      </div>
    </div>
  );
}
function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}</span></div>;
}
