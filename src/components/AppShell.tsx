import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Award,
  BarChart3,
  Users,
  Sparkles,
  UserCog,
  Menu,
  LogOut,
  Waves,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/lib/theme";
import { useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";

type NavItem = { to: string; label: string; icon: typeof BookOpen; roles: AppRole[] };

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "trainer", "trainee"],
  },
  { to: "/courses", label: "Course Catalog", icon: BookOpen, roles: ["admin", "trainer", "trainee"] },
  { to: "/my-learning", label: "My Learning", icon: GraduationCap, roles: ["trainee", "admin"] },
  { to: "/certificates", label: "Certificates", icon: Award, roles: ["trainee", "admin", "trainer"] },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles, roles: ["admin", "trainer", "trainee"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "trainer"] },
  { to: "/manage-courses", label: "Manage Courses", icon: ScrollText, roles: ["admin", "trainer"] },
  { to: "/admin", label: "Admin Console", icon: ShieldCheck, roles: ["admin"] },
  { to: "/users", label: "User Management", icon: Users, roles: ["admin"] },
  { to: "/profile", label: "Profile", icon: UserCog, roles: ["admin", "trainer", "trainee"] },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((n) => (role ? n.roles.includes(role) : n.roles.includes("trainee")));

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-lift"
                : "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="gradient-accent flex size-9 items-center justify-center rounded-xl text-primary-foreground">
        <Waves className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-sm font-bold text-sidebar-foreground">CAPACITY CONNECT</span>
        <span className="block text-[11px] text-sidebar-foreground/60">Ministry of Earth Sciences</span>
      </span>
    </Link>
  );
}

export function AppShell({
  title,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  breadcrumb?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="px-1 pb-6">
          <Brand />
        </div>
        <NavLinks />
        <div className="mt-auto rounded-xl bg-sidebar-primary p-3">
          <p className="text-xs font-semibold text-sidebar-primary-foreground">SIH 2026 · SIH26075</p>
          <p className="mt-1 text-[11px] text-sidebar-primary-foreground/75">
            Digital capacity building for earth-system professionals.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="px-1 pb-6">
                <Brand />
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            {breadcrumb && (
              <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {breadcrumb}
              </p>
            )}
            <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            {actions}
            <NotificationBell />
            <ThemeToggle />
            <div className="hidden items-center gap-2 pl-2 sm:flex">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary-soft text-xs font-semibold text-secondary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="max-w-[140px] truncate text-xs font-semibold">
                  {profile?.full_name || "User"}
                </p>
                {role && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] capitalize">
                    {role}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
