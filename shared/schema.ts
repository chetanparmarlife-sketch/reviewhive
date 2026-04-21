// Plain TypeScript types for the ReviewHive data model.
// The canonical schema lives in supabase/migrations/0001_initial.sql.
// These types mirror the row shape returned by Supabase JS client.

export type UserRole = "reviewer" | "admin";

export type Marketplace = "amazon_in" | "flipkart" | "meesho";

export type CampaignStatus = "draft" | "live" | "paused" | "completed";

export type ApplicationStatus =
  | "applied"
  | "approved"
  | "rejected"
  | "reserved"
  | "purchased"
  | "submitted"
  | "verified"
  | "paid"
  | "rejected_submission";

export type PayoutStatus = "queued" | "processing" | "paid" | "failed";

export interface Profile {
  id: string; // uuid — references auth.users.id
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  upi_id: string | null;
  pan_number: string | null;
  avatar_url: string | null;
  total_earnings: number;
  completed_campaigns: number;
  trust_score: number;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  industry: string;
  description: string | null;
  website: string | null;
  gst_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  title: string;
  brand_id: string;
  marketplace: Marketplace;
  description: string;
  reward_amount: number;
  total_slots: number;
  slots_filled: number;
  status: CampaignStatus;
  start_date: string;
  end_date: string;
  requirements: string[]; // jsonb
  cover_image_url: string | null;
  category: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  brand?: Brand;
  products?: Product[];
}

export interface Product {
  id: string;
  campaign_id: string;
  name: string;
  asin_or_id: string;
  marketplace_url: string;
  price: number;
  image_url: string | null;
  position: number;
}

export interface Application {
  id: string;
  campaign_id: string;
  user_id: string;
  product_id: string | null;
  status: ApplicationStatus;
  order_id: string | null;
  order_proof_url: string | null;
  review_link: string | null;
  review_proof_url: string | null;
  review_text: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  paid_at: string | null;
  payout_utr: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  applied_at: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  application_id: string;
  user_id: string;
  amount: number;
  status: PayoutStatus;
  utr: string | null;
  razorpay_payout_id: string | null;
  tds_amount: number;
  created_at: string;
  paid_at: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}
