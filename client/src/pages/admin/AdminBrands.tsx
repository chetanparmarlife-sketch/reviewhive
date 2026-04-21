import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { queryClient, qk } from "@/lib/queryClient";
import { listBrands, createBrand, listCampaignsWithBrand } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import type { Brand, Campaign } from "@shared/schema";

export default function AdminBrands() {
  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: qk.brands,
    queryFn: listBrands,
  });
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: qk.campaigns,
    queryFn: listCampaignsWithBrand,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", description: "", website: "", gst_number: "" });
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: async () => {
      // Inline SVG logo generated from brand initial.
      const initial = form.name[0] ?? "?";
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' rx='16' fill='#f59e0b'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='40' font-weight='700' fill='white'>${initial}</text></svg>`;
      const logoUrl = `data:image/svg+xml;utf8,` + encodeURIComponent(svg);
      return createBrand({
        name: form.name,
        industry: form.industry,
        description: form.description || null,
        logo_url: logoUrl,
        website: form.website || null,
        gst_number: form.gst_number || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.brands });
      toast({ title: "Brand added" });
      setForm({ name: "", industry: "", description: "", website: "", gst_number: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout title="Brands">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-brands-heading">Brands</h2>
            <p className="text-sm text-muted-foreground">{brands.length} brands onboarded</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5" data-testid="button-new-brand"><Plus className="h-4 w-4" /> Add brand</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add brand</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="brand-name">Name</Label>
                  <Input id="brand-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-brand-name" />
                </div>
                <div>
                  <Label htmlFor="brand-industry">Industry</Label>
                  <Input id="brand-industry" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} data-testid="input-brand-industry" />
                </div>
                <div>
                  <Label htmlFor="brand-website">Website</Label>
                  <Input id="brand-website" placeholder="https://…" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} data-testid="input-brand-website" />
                </div>
                <div>
                  <Label htmlFor="brand-gst">GST number</Label>
                  <Input id="brand-gst" value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value })} data-testid="input-brand-gst" />
                </div>
                <div>
                  <Label htmlFor="brand-desc">Description</Label>
                  <Textarea id="brand-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} data-testid="textarea-brand-description" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending} data-testid="button-create-brand">
                  {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save brand
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => {
            const count = campaigns.filter((c) => c.brand_id === b.id).length;
            return (
              <Card key={b.id} className="border-card-border" data-testid={`card-brand-${b.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {b.logo_url && <img src={b.logo_url} alt="" className="h-12 w-12 rounded-lg" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.industry}</div>
                    </div>
                  </div>
                  {b.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{b.description}</p>}
                  <div className="text-xs font-medium">{count} campaign{count === 1 ? "" : "s"}</div>
                </CardContent>
              </Card>
            );
          })}
          {brands.length === 0 && (
            <div className="col-span-full p-10 text-center text-sm text-muted-foreground" data-testid="text-no-brands">
              No brands yet. Click "Add brand" to get started.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
