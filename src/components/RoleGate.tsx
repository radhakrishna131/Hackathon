import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, type AppRole } from "@/lib/auth";

const LABEL: Record<AppRole, string> = {
  admin: "Administrator",
  trainer: "Trainer",
  trainee: "Trainee",
};

/**
 * Returns a screen to render when the signed-in user may not view the page,
 * or `null` when access is granted.
 */
export function useRoleGuard(
  allow: AppRole[],
  page: { title: string; breadcrumb: string },
): ReactNode | null {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <AppShell title={page.title} breadcrumb={page.breadcrumb}>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!role || !allow.includes(role)) {
    return (
      <AppShell title={page.title} breadcrumb={page.breadcrumb}>
        <div className="surface-card p-12 text-center">
          <ShieldAlert className="text-destructive mx-auto size-8" />
          <p className="mt-3 font-medium">
            {allow.map((r) => LABEL[r]).join(" or ")} access required
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You are signed in as {role ? LABEL[role] : "an unassigned user"}. Ask a Capacity
            Connect administrator to update your role.
          </p>
        </div>
      </AppShell>
    );
  }

  return null;
}
