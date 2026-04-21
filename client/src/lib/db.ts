// Typed wrappers around the Supabase client. Every backend interaction the
// UI performs goes through one of these functions. Keeps pages concise and
// lets us swap storage implementations without touching views.

import { isSupabaseConfigured, supabase } from "./supabase";
import type {
  Profile, Brand, Campaign, Product, Application,
  Notification, ApplicationStatus, CampaignStatus,
} from "@shared/schema";

// ---------- helpers ----------
function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("No data returned");
  return data;
}

function assertSupabaseConfigured(): void {
  if (isSupabaseConfigured()) return;
  throw new Error(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env or .env.local, then restart the app.",
  );
}

// ==================== PROFILES ====================
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

export async function listReviewerProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles").select("*").eq("role", "reviewer").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "name" | "phone" | "upi_id" | "pan_number" | "avatar_url">>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles").update(patch).eq("id", userId).select().single();
  return unwrap(data as Profile, error);
}

// Admin-only: toggle block, change role.
export async function adminUpdateProfile(
  userId: string,
  patch: Partial<Profile>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles").update(patch).eq("id", userId).select().single();
  return unwrap(data as Profile, error);
}

// ==================== BRANDS ====================
export async function listBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from("brands").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Brand[];
}

export async function createBrand(
  input: Omit<Brand, "id" | "created_at" | "updated_at">,
): Promise<Brand> {
  const { data, error } = await supabase
    .from("brands").insert(input).select().single();
  return unwrap(data as Brand, error);
}

// ==================== CAMPAIGNS ====================
// Live feed for reviewers — RLS already restricts to status='live'.
export async function listCampaignsWithBrand(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, brand:brands(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Campaign[];
}

// Admin feed — returns ALL statuses. RLS allows it because is_admin() is true.
export async function adminListCampaigns(): Promise<Campaign[]> {
  return listCampaignsWithBrand();
}

export async function getCampaignDetail(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, brand:brands(*), products(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Campaign) ?? null;
}

export async function createCampaignWithProducts(
  campaign: Omit<Campaign, "id" | "created_at" | "updated_at" | "slots_filled" | "brand" | "products">,
  products: Array<Omit<Product, "id" | "campaign_id">>,
): Promise<Campaign> {
  const { data: camp, error } = await supabase
    .from("campaigns").insert(campaign).select().single();
  if (error) throw new Error(error.message);
  if (products.length > 0) {
    const payload = products.map((p, i) => ({ ...p, campaign_id: (camp as Campaign).id, position: p.position ?? i }));
    const { error: pErr } = await supabase.from("products").insert(payload);
    if (pErr) throw new Error(pErr.message);
  }
  return camp as Campaign;
}

export async function updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns").update(patch).eq("id", id).select().single();
  return unwrap(data as Campaign, error);
}

// ==================== APPLICATIONS ====================

export async function listApplicationsForUser(userId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications").select("*")
    .eq("user_id", userId)
    .order("applied_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Application[];
}

export async function listAllApplications(filters?: {
  status?: ApplicationStatus; campaignId?: string;
}): Promise<Application[]> {
  let q = supabase.from("applications").select("*").order("applied_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.campaignId) q = q.eq("campaign_id", filters.campaignId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Application[];
}

/** Apply via Edge Function (atomic slot check). */
export async function applyToCampaign(campaignId: string): Promise<Application> {
  const { data, error } = await supabase.functions.invoke("apply-to-campaign", {
    body: { campaign_id: campaignId },
  });
  if (error) throw new Error(error.message);
  if ((data as any).error) throw new Error((data as any).error);
  return (data as any).application as Application;
}

/** Reviewer-side update (reserve product, log order, submit review). */
export async function updateOwnApplication(
  applicationId: string,
  patch: Partial<Pick<Application, "status" | "product_id" | "order_id" | "order_proof_url" | "review_link" | "review_proof_url" | "review_text">>,
): Promise<Application> {
  const { data, error } = await supabase
    .from("applications").update(patch).eq("id", applicationId).select().single();
  return unwrap(data as Application, error);
}

/** Admin path — goes through Edge Function for approve/reject. */
export async function approveApplication(applicationId: string): Promise<Application> {
  const { data, error } = await supabase.functions.invoke("approve-application", {
    body: { application_id: applicationId },
  });
  if (error) throw new Error(error.message);
  if ((data as any).error) throw new Error((data as any).error);
  return (data as any).application as Application;
}

export async function rejectApplication(
  applicationId: string,
  reason: string,
  stage: "application" | "submission" = "application",
): Promise<Application> {
  const { data, error } = await supabase.functions.invoke("reject-application", {
    body: { application_id: applicationId, reason, stage },
  });
  if (error) throw new Error(error.message);
  if ((data as any).error) throw new Error((data as any).error);
  return (data as any).application as Application;
}

/** Admin: flip to any status. Used by AdminSubmissions for verified/etc. */
export async function adminUpdateApplication(
  applicationId: string,
  patch: Partial<Application>,
): Promise<Application> {
  const { data, error } = await supabase
    .from("applications").update(patch).eq("id", applicationId).select().single();
  return unwrap(data as Application, error);
}

/** Admin: trigger payout via Edge Function (Razorpay or stubbed). */
export async function triggerPayout(applicationId: string): Promise<{ utr: string; mocked?: boolean }> {
  const { data, error } = await supabase.functions.invoke("trigger-payout", {
    body: { application_id: applicationId },
  });
  if (error) throw new Error(error.message);
  if ((data as any).error) throw new Error((data as any).error);
  return { utr: (data as any).utr, mocked: (data as any).mocked };
}

// ==================== NOTIFICATIONS ====================

export async function listNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications").select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications").update({ read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications").update({ read: true })
    .eq("user_id", userId).eq("read", false);
  if (error) throw new Error(error.message);
}

// ==================== STATS (for admin dashboard) ====================

export interface StatsResponse {
  activeCampaigns: number;
  liveApplications: number;
  pendingVerifications: number;
  pendingPayouts: number;
  paidThisMonth: number;
  paidCountThisMonth: number;
  totalReviewers: number;
  perDay: Array<{ date: string; count: number }>;
}

export async function fetchAdminStats(): Promise<StatsResponse> {
  // Aggregate client-side from admin-accessible tables.
  const [{ data: camps }, { data: apps }, { data: users }] = await Promise.all([
    supabase.from("campaigns").select("id, status, reward_amount"),
    supabase.from("applications").select("id, status, paid_at, campaign_id, applied_at"),
    supabase.from("profiles").select("id, role").eq("role", "reviewer"),
  ]);

  const campsList = camps ?? [];
  const appsList = apps ?? [];
  const activeCamps = campsList.filter((c: any) => c.status === "live").length;
  const submitted = appsList.filter((a: any) => a.status === "submitted");
  const verified = appsList.filter((a: any) => a.status === "verified");
  const paid = appsList.filter((a: any) => a.status === "paid");

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const paidThisMonth = paid.filter((a: any) => a.paid_at && new Date(a.paid_at).getTime() >= monthStart.getTime());
  const campByIdReward: Record<string, number> = {};
  for (const c of campsList) campByIdReward[(c as any).id] = (c as any).reward_amount;
  const paidAmountThisMonth = paidThisMonth.reduce(
    (sum: number, a: any) => sum + (campByIdReward[a.campaign_id] ?? 0),
    0,
  );

  // 30-day bucket
  const day = 24 * 60 * 60 * 1000;
  const dayBuckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * day);
    dayBuckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const a of appsList) {
    const d = new Date((a as any).applied_at).toISOString().slice(0, 10);
    if (d in dayBuckets) dayBuckets[d]++;
  }
  const perDay = Object.entries(dayBuckets).map(([date, count]) => ({ date, count }));

  return {
    activeCampaigns: activeCamps,
    liveApplications: appsList.filter((a: any) => ["applied", "approved", "reserved", "purchased"].includes(a.status)).length,
    pendingVerifications: submitted.length,
    pendingPayouts: verified.length,
    paidThisMonth: paidAmountThisMonth,
    paidCountThisMonth: paidThisMonth.length,
    totalReviewers: (users ?? []).length,
    perDay,
  };
}

// ==================== AUTH helpers ====================
export async function emailSignUp(args: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  emailRedirectTo?: string;
}) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signUp({
    email: args.email,
    password: args.password,
    options: {
      emailRedirectTo: args.emailRedirectTo,
      data: { name: args.name, phone: args.phone ?? null },
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function emailSignIn(email: string, password: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function sendPhoneOtp(phone: string) {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      // Supabase sends via the configured SMS provider.
      // With MSG91 custom SMS configured, template is picked from provider config.
      channel: "whatsapp" as any,
    },
  });
  if (error) throw new Error(error.message);
}

export async function verifyPhoneOtp(phone: string, token: string) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.verifyOtp({
    phone, token, type: "sms" as any,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ==================== FILE helpers ====================
/** Short-lived signed URL for admin viewing private order/review proofs. */
export async function createSignedUrl(bucket: string, path: string, expiresInSec = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data.signedUrl;
}

export const _statusTypes = { ApplicationStatus: null as any as ApplicationStatus, CampaignStatus: null as any as CampaignStatus };
