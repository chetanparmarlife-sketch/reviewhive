import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useSession, setSessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { queryClient, qk } from "@/lib/queryClient";
import { listNotifications, signOut } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Bell, LayoutGrid, Briefcase, Wallet, User as UserIcon, LogOut, Home, Compass, MessageCircle } from "lucide-react";
import type { Notification } from "@shared/schema";

export function ReviewerLayout({ children, title }: { children: ReactNode; title?: string }) {
  const user = useSession();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (title) document.title = `${title} — ReviewHive`;
  }, [title]);

  useEffect(() => {
    if (user === null) {
      // session initialized and confirmed unauthenticated
      setLocation("/login");
    } else if (user && user.role !== "reviewer") {
      setLocation("/login");
    }
  }, [user, setLocation]);

  const { data: notifs = [] } = useQuery<Notification[]>({
    queryKey: qk.notifications(user?.id),
    queryFn: () => (user ? listNotifications(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  // Subscribe to new notifications in realtime. Invalidate the query on insert.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: qk.notifications(user.id) });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  const unread = notifs.filter(n => !n.read).length;

  async function handleLogout() {
    await signOut();
    setSessionUser(null);
    setLocation("/");
  }

  const nav = [
    { href: "/campaigns", label: "Campaigns", mobileLabel: "Campaigns", icon: LayoutGrid },
    { href: "/applications", label: "My Applications", mobileLabel: "Apps", icon: Briefcase },
    { href: "/wallet", label: "Wallet", mobileLabel: "Wallet", icon: Wallet },
    { href: "/notifications", label: "Notifications", mobileLabel: "Alerts", icon: Bell },
    { href: "/profile", label: "Profile", mobileLabel: "Profile", icon: UserIcon },
  ];
  const mobileNav = [
    { href: "/applications", label: "Home", icon: Home },
    { href: "/campaigns", label: "Discover", icon: Compass },
    { href: "/notifications", label: "Messages", icon: MessageCircle },
    { href: "/wallet", label: "Wallet", icon: Wallet },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/campaigns">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(item => {
          const active = location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm hover-elevate ${
                active ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-sidebar-foreground"
              }`}
              data-testid={`link-${item.label.toLowerCase().replace(/ /g, "-")}`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/notifications" && unread > 0 && (
                <Badge variant="default" className="h-5 min-w-5 px-1.5 bg-primary text-primary-foreground">{unread}</Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground text-center">ReviewHive · {new Date().getFullYear()}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background mobile-app-shell">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex w-60 border-r border-sidebar-border bg-sidebar flex-col">
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center px-3 md:px-6 gap-2">
          <div className="md:hidden flex items-center gap-2 min-w-0 flex-1">
            <div className="relative">
              <Avatar className="h-8 w-8 border border-border">
                {user?.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {user?.name?.[0] ?? "U"}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <h1 className="text-base font-bold truncate" data-testid="text-page-title">
              {title ?? "Discover"}
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2 flex-1">
            {title && <h1 className="text-sm md:text-base font-semibold truncate" data-testid="text-page-title">{title}</h1>}
          </div>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <div>
            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                )}
              </Button>
            </Link>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2 h-9" data-testid="button-user-menu">
                <Avatar className="h-7 w-7">
                  {user?.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {user?.name?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm">{user?.name?.split(" ")[0]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/campaigns")} data-testid="menu-campaigns">Discover</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/applications")} data-testid="menu-applications">My Applications</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/profile")} data-testid="menu-profile">Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/wallet")} data-testid="menu-wallet">Wallet</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                <LogOut className="h-4 w-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 min-w-0 pb-24 md:pb-0">{children}</main>
      </div>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mobile-glass rounded-2xl px-2 py-1.5">
          <div className="grid grid-cols-4 gap-1">
            {mobileNav.map((item) => {
              const active = location.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition-colors ${
                    active ? "text-primary bg-primary/10" : "text-muted-foreground"
                  }`}
                  data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="h-[18px] w-[18px] mb-1" />
                  <span className="leading-none">{item.label}</span>
                  {item.href === "/notifications" && unread > 0 && (
                    <Badge className="absolute top-1 right-3 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
