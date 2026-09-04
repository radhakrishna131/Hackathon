import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  BookOpen,
  GraduationCap,
  Award,
  TrendingUp,
  UserCheck,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchCourses, fetchMyEnrollments } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Capacity Connect" },
      { name: "description", content: "Your personalised MoES capacity building dashboard." },
      { property: "og:title", content: "Dashboard — Capacity Connect" },
      { property: "og:description", content: "Your personalised MoES capacity building dashboard." },
    ],
  }),
  component: Dashboard,
});

function count(table: "profiles" | "courses" | "enrollments" | "certificates" | "user_roles") {
  return supabase.from(table).select("id", { count: "exact", head: true });
}

function Dashboard() {
  const { profile, role, user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    enabled: role === "admin" || role === "trainer",
    queryFn: async () => {
      const [users, courses, enrolments, certs, trainers] = await Promise.all([
        count("profiles"),
        count("courses"),
        count("enrollments"),
        count("certificates"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "trainer"),
      ]);
      return {
        users: users.count ?? 0,
        courses: courses.count ?? 0,
        enrolments: enrolments.count ?? 0,
        certs: certs.count ?? 0,
        trainers: trainers.count ?? 0,
      };
    },
  });

  const { data: enrollments = [], isLoading: loadingEnrol } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyEnrollments(user!.id),
  });

  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });

  const enrolledIds = new Set(enrollments.map((e) => e.course_id));
  const recommended = courses.filter((c) => !enrolledIds.has(c.id)).slice(0, 3);
  const learningHours = enrollments.reduce(
    (sum, e) => sum + ((e.courses as { duration_hours: number } | null)?.duration_hours ?? 0) * (e.progress / 100),
    0,
  );

  const firstName = (profile?.full_name || "there").split(" ")[0];

  return (
    <AppShell title={`Good day, ${firstName}`} breadcrumb="Home / Dashboard">
      {(role === "admin" || role === "trainer") && (
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {role === "admin" ? "Institution overview" : "Programme overview"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={Users} label="Total users" value={stats?.users ?? 0} loading={isLoading} />
            <StatCard
              icon={UserCheck}
              label="Trainers"
              value={stats?.trainers ?? 0}
              loading={isLoading}
            />
            <StatCard icon={BookOpen} label="Courses" value={stats?.courses ?? 0} loading={isLoading} />
            <StatCard
              icon={GraduationCap}
              label="Enrolments"
              value={stats?.enrolments ?? 0}
              loading={isLoading}
            />
            <StatCard icon={Award} label="Certificates" value={stats?.certs ?? 0} loading={isLoading} />
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Continue learning
            </h2>
            <Link to="/my-learning">
              <Button variant="ghost" size="sm" className="gap-1">
                All courses <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>

          {loadingEnrol && <Skeleton className="h-32 w-full rounded-xl" />}

          {!loadingEnrol && enrollments.length === 0 && (
            <div className="surface-card p-8 text-center">
              <p className="font-medium">You haven't enrolled in a programme yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse the catalog to start building your competencies.
              </p>
              <Link to="/courses">
                <Button className="mt-4">Browse catalog</Button>
              </Link>
            </div>
          )}

          <div className="space-y-4">
            {enrollments.map((e) => {
              const c = e.courses as { title: string; slug: string; category: string } | null;
              if (!c) return null;
              return (
                <Link
                  key={e.id}
                  to="/courses/$slug"
                  params={{ slug: c.slug }}
                  className="surface-card hover-lift block p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Badge variant="secondary">{c.category}</Badge>
                      <h3 className="font-display mt-2 font-semibold">{c.title}</h3>
                    </div>
                    <Badge variant={e.progress >= 100 ? "default" : "outline"}>
                      {e.progress >= 100 ? "Completed" : `${e.progress}%`}
                    </Badge>
                  </div>
                  <Progress value={e.progress} className="mt-4 h-2" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">Your snapshot</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4" /> Learning hours
                </dt>
                <dd className="font-semibold">{learningHours.toFixed(1)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="size-4" /> Active courses
                </dt>
                <dd className="font-semibold">
                  {enrollments.filter((e) => e.progress < 100).length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Award className="size-4" /> Completed
                </dt>
                <dd className="font-semibold">
                  {enrollments.filter((e) => e.progress >= 100).length}
                </dd>
              </div>
            </dl>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-accent size-4" />
              <h3 className="text-sm font-semibold">Recommended for you</h3>
            </div>
            <div className="mt-4 space-y-3">
              {recommended.map((c) => (
                <Link
                  key={c.id}
                  to="/courses/$slug"
                  params={{ slug: c.slug }}
                  className="block rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
                >
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.category} · {c.duration_hours}h
                  </p>
                </Link>
              ))}
            </div>
            <Link to="/assistant">
              <Button variant="outline" size="sm" className="mt-4 w-full">
                Get an AI learning path
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
