import { marketplaceMeta, statusMeta } from "@/lib/session";

export function MarketplaceBadge({ marketplace, size = "sm" }: { marketplace: string; size?: "sm" | "md" }) {
  const meta = marketplaceMeta(marketplace);
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border ${meta.color} ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
      }`}
      data-testid={`badge-marketplace-${marketplace}`}
    >
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${meta.color} ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
      }`}
      data-testid={`badge-status-${status}`}
    >
      {meta.label}
    </span>
  );
}
