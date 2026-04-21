import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useSession, setSessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, Megaphone, Inbox, Wallet2, Users, Building2, Menu, LogOut, Bell,
} from "lucide-react";

export function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const user = useSession();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (title) document.title = `${title} — ReviewHive Admin`;
  }, [title]);

  useEffect(() => {
    if (!user || user.role !== "admin") setLocation("/admin/login");
  }, [user]);

  const nav = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
    { href: "/admin/submissions", label: "Submissions", icon: Inbox },
    { href: "/admin/payouts", label: "Payouts", icon: Wallet2 },
    { href: "/admin/users", label: "Reviewers", icon: Users },
    { href: "/admin/brands", label: "Brands", icon: Building2 },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border flex items-center gap-2">
        <Link href="/admin" onClick={() => setMobileOpen(false)}>
          <Logo />
        </Link>
        <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/20 text-primary-foreground/80 border border-primary/30 text-primary">ADMIN</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(item => {
          const active = item.exact ? location === item.href : location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm hover-elevate ${
                active ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-sidebar-foreground"
              }`}
              data-testid={`link-admin-${item.label.toLowerCase()}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border text-xs text-muted-foreground text-center">
        Prototype · not a real service
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-60 border-r border-sidebar-border bg-sidebar flex-col">
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center px-3 md:px-6 gap-2">
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-admin-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">{sidebarContent}</SheetContent>
            </Sheet>
          </div>
          <div className="md:hidden"><Logo showWordmark={false} size={28} /></div>
          {title && <h1 className="text-sm md:text-base font-semibold flex-1 ml-2 truncate" data-testid="text-admin-page-title">{title}</h1>}
          <div className="flex-1 md:hidden" />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2 h-9" data-testid="button-admin-user-menu">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">A</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm">{user?.name ?? "Admin"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.name ?? "Admin"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setSessionUser(null); setLocation("/admin/login"); }} data-testid="menu-admin-logout">
                <LogOut className="h-4 w-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
