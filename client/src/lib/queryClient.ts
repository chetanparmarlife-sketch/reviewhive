// React Query client — used only for caching and invalidation.
// Supabase calls are made directly via db.ts helpers; queryFn is set per-query.

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000, // 30s — dashboards revalidate on tab change
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Re-export query key helpers so pages don't hardcode magic strings.
export const qk = {
  publicCampaigns: ["public-campaigns"] as const,
  campaigns: ["campaigns"] as const,
  reviewerCampaigns: (userId: string | undefined) => ["campaigns", "reviewer", userId ?? ""] as const,
  campaign: (id: string) => ["campaign", id] as const,
  brands: ["brands"] as const,
  reviewers: ["reviewers"] as const,
  applications: ["applications"] as const,
  applicationsForUser: (userId: string | undefined) => ["applications", "user", userId ?? ""] as const,
  applicationsForCampaign: (campaignId: string) => ["applications", "campaign", campaignId] as const,
  applicationsByStatus: (status: string) => ["applications", "status", status] as const,
  notifications: (userId: string | undefined) => ["notifications", userId ?? ""] as const,
  profile: (id: string | undefined) => ["profile", id ?? ""] as const,
  stats: ["admin-stats"] as const,
};
