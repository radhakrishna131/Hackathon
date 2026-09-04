import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldAlert,
  Users,
  BookOpen,
  GraduationCap,
  Award,
  BarChart3,
  ScrollText,
  Trash2,
  Eye,
  EyeOff,
  Activity,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useRoleGuard } from "@/components/RoleGate";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — Capacity Connect" },
      {
        name: "description",
        content:
          "Ministry-wide control centre: platform metrics, course publishing, enrolments, certification and audit activity.",
      },
      { property: "og:title", content: "Admin console — Capacity Connect" },
      {
        property: "og:description",
        content: "Platform metrics, course publishing, enrolments and audit activity in one console.",
      },
    ],
  }),
  component: AdminConsole,
});

type AdminData = {
  users: number;
  trainers: number;
  trainees: number;
  admins: number;
  courses: { id: string; title: string; category: string; is_published: boolean; created_at: string }[];
  enrollments: number;
  completions: number;
  certificates: number;
  attempts: number;
  passRate: number;
  recentCerts: { id: string; certificate_no: string; score: number; issued_at: string }[];
  audit: { id: string; action: string; entity: string; created_at: string }[];
};

function AdminConsole() {
  const { role } = useAuth();
  const gate = useRoleGuard(["admin"], { title: "Admin console", breadcrumb: "Home / Administration" });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<AdminData>({
    queryKey: ["admin-console"],
    enabled: role === "admin",
    queryFn: async () => {
      const [profiles, roles, courses, enrollments, certificates, attempts, audit] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase
          .from("courses")
          .select("id, title, category, is_published, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("enrollments").select("status"),
        supabase
          .from("certificates")
          .select("id, certificate_no, score, issued_at")
          .order("issued_at", { ascending: false })
          .limit(6),
        supabase.from("attempts").select("passed"),
        supabase
          .from("audit_logs")
          .select("id, action, entity, created_at")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      const roleRows = roles.data ?? [];
      const enrolRows = enrollments.data ?? [];
      const attemptRows = attempts.data ?? [];

      return {
        users: profiles.count ?? 0,
        trainers: roleRows.filter((r) => r.role === "trainer").length,
        trainees: roleRows.filter((r) => r.role === "trainee").length,
        admins: roleRows.filter((r) => r.role === "admin").length,
        courses: courses.data ?? [],
        enrollments: enrolRows.length,
        completions: enrolRows.filter((e) => e.status === "completed").length,
        certificates: (certificates.data ?? []).length,
        attempts: attemptRows.length,
        passRate: attemptRows.length
          ? Math.round((attemptRows.filter((a) => a.passed).length / attemptRows.length) * 100)
          : 0,
        recentCerts: certificates.data ?? [],
        audit: audit.data ?? [],
      };
    },
  });

  const togglePublish = async (id: string, next: boolean) => {
    const { error } = await supabase.from("courses").update({ is_published: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Programme published" : "Programme unpublished");
    qc.invalidateQueries({ queryKey: ["admin-console"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
  };

  const removeCourse = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}" and all of its content?`)) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Programme deleted");
    qc.invalidateQueries({ queryKey: ["admin-console"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
  };

  if (gate) return gate;
  if (role !== "admin") {
    return (
      <AppShell title="Admin console" breadcrumb="Home / Administration">
        <div className="surface-card p-12 text-center">
          <ShieldAlert className="text-destructive mx-auto size-8" />
          <p className="mt-3 font-medium">Administrator access required</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask a Capacity Connect administrator to grant you the admin role.
          </p>
        </div>
      </AppShell>
    );
  }

  const completionRate = data?.enrollments ? Math.round((data.completions / data.enrollments) * 100) : 0;

  return (
    <AppShell
      title="Admin console"
      breadcrumb="Home / Administration"
      actions={
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link to="/analytics">
            <BarChart3 className="size-4" />
            Analytics
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="gradient-hero shadow-lift rounded-2xl p-6 sm:p-8">
          <Badge className="bg-primary text-primary-foreground">Control centre</Badge>
          <h2 className="font-display mt-3 text-2xl font-bold text-hero-foreground sm:text-3xl">
            Everything happening across MoES capacity building
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-hero-foreground/80">
            Publish or retire programmes, watch enrolment and certification throughput, and audit every
            action taken on the platform.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="Total users"
            value={data?.users ?? 0}
            hint={`${data?.trainees ?? 0} trainees · ${data?.trainers ?? 0} trainers · ${data?.admins ?? 0} admins`}
            loading={isLoading}
          />
          <StatCard
            icon={BookOpen}
            label="Programmes"
            value={data?.courses.length ?? 0}
            hint={`${data?.courses.filter((c) => c.is_published).length ?? 0} published`}
            loading={isLoading}
          />
          <StatCard
            icon={GraduationCap}
            label="Enrolments"
            value={data?.enrollments ?? 0}
            hint={`${completionRate}% completion rate`}
            loading={isLoading}
          />
          <StatCard
            icon={Award}
            label="Certificates"
            value={data?.certificates ?? 0}
            hint={`${data?.attempts ?? 0} attempts · ${data?.passRate ?? 0}% pass rate`}
            loading={isLoading}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <QuickLink
            to="/users"
            icon={Users}
            title="User management"
            body="Search users, review activity and assign admin, trainer or trainee roles."
          />
          <QuickLink
            to="/manage-courses"
            icon={ScrollText}
            title="Course authoring"
            body="Create programmes, generate AI quizzes and monitor learner performance."
          />
          <QuickLink
            to="/analytics"
            icon={BarChart3}
            title="Institutional analytics"
            body="Growth, enrolment trends, learning hours and assessment outcomes."
          />
        </div>

        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h3 className="font-display text-base font-semibold">Programme catalogue</h3>
              <p className="text-xs text-muted-foreground">Publish, retire or delete any programme.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/courses">Browse catalog</Link>
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programme</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.courses ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell className="text-muted-foreground">{c.category}</TableCell>
                      <TableCell>
                        <Badge variant={c.is_published ? "default" : "secondary"}>
                          {c.is_published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePublish(c.id, !c.is_published)}
                        >
                          {c.is_published ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                          {c.is_published ? "Unpublish" : "Publish"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeCourse(c.id, c.title)}
                          aria-label={`Delete ${c.title}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card p-5">
            <h3 className="font-display flex items-center gap-2 text-base font-semibold">
              <Activity className="size-4" /> Audit activity
            </h3>
            <ul className="mt-4 space-y-3">
              {(data?.audit ?? []).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{a.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{a.entity || "platform"}</p>
                  </div>
                  <span className="text-xs whitespace-nowrap text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
              {!isLoading && !(data?.audit ?? []).length && (
                <li className="text-sm text-muted-foreground">No recorded activity yet.</li>
              )}
            </ul>
          </div>

          <div className="surface-card p-5">
            <h3 className="font-display flex items-center gap-2 text-base font-semibold">
              <Award className="size-4" /> Latest certificates
            </h3>
            <ul className="mt-4 space-y-3">
              {(data?.recentCerts ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-mono text-xs font-medium">{c.certificate_no}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary">{c.score}%</Badge>
                </li>
              ))}
              {!isLoading && !(data?.recentCerts ?? []).length && (
                <li className="text-sm text-muted-foreground">No certificates issued yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: "/users" | "/manage-courses" | "/analytics";
  icon: typeof Users;
  title: string;
  body: string;
}) {
  return (
    <Link to={to} className="surface-card hover-lift block p-5">
      <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </span>
      <p className="font-display mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
