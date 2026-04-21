import { useQuery, useMutation } from "@tanstack/react-query";
import { ReviewerLayout } from "@/components/ReviewerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { queryClient, qk } from "@/lib/queryClient";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/db";
import { Bell, IndianRupee, RefreshCw, CalendarCheck, AlertCircle } from "lucide-react";
import type { Notification } from "@shared/schema";

function iconFor(type: string) {
  if (type === "payout") return IndianRupee;
  if (type === "status_change" || type === "application_approved" || type === "application_rejected") return RefreshCw;
  if (type === "new_campaign") return CalendarCheck;
  return AlertCircle;
}

export default function Notifications() {
  const user = useSession();
  const { data: notifs = [] } = useQuery<Notification[]>({
    queryKey: qk.notifications(user?.id),
    queryFn: () => (user ? listNotifications(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications(user!.id) }),
  });
  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications(user!.id) }),
  });

  const unread = notifs.filter(n => !n.read).length;

  return (
    <ReviewerLayout title="Notifications">
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
            <p className="text-sm text-muted-foreground" data-testid="text-unread-count">{unread} unread</p>
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => readAll.mutate()} data-testid="button-mark-all-read">
              Mark all as read
            </Button>
          )}
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            {notifs.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <div className="font-semibold">No notifications yet</div>
                <p className="text-sm text-muted-foreground mt-1">Apply to a campaign to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifs.map(n => {
                  const Icon = iconFor(n.type);
                  return (
                    <button
                      key={n.id}
                      onClick={() => !n.read && readOne.mutate(n.id)}
                      className={`w-full text-left p-4 flex items-start gap-3 hover-elevate ${!n.read ? "bg-primary/5" : ""}`}
                      data-testid={`notification-${n.id}`}
                    >
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.read ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("en-IN")}</div>
                      </div>
                      {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ReviewerLayout>
  );
}
