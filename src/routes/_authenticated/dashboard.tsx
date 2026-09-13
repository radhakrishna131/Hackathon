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
  Gauge,
  Route as RouteIcon,

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
import { fetchMySkills, fetchMyRoadmap, band, BAND_LABEL } from "@/lib/skills";


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

  const { data: mySkills = [] } = useQuery({
    queryKey: ["my-skills", user?.id],
    enabled: !!user,
    queryFn: () => fetchMySkills(user!.id),
  });

  const { data: roadmap } = useQuery({
    queryKey: ["roadmap", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyRoadmap(user!.id),
  });

  const overallSkill = mySkills.length
    ? Math.round(mySkills.reduce((s, k) => s + k.score, 0) / mySkills.length)
    : 0;
  const weakSkills = [...mySkills].sort((a, b) => a.score - b.score).slice(0, 3);
  const roadmapItems = ((roadmap?.roadmap_items ?? []) as {
    id: string;
    status: string;
    reason: string;
    position: number;
    courses: { title: string; slug: string; category: string } | null;
  }[]).sort((a, b) => a.position - b.position);
  const nextStep = roadmapItems.find((i) => i.status === "recommended" || i.status === "in_progress");



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
            <div className="flex items-center gap-2">
              <Gauge className="text-primary size-4" />
              <h3 className="text-sm font-semibold">Your competency</h3>
            </div>
            {mySkills.length === 0 ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Take the skill assessment to measure your competencies and unlock a personalised
                  roadmap.
                </p>
                <Link to="/assessment/skill">
                  <Button size="sm" className="mt-4 w-full">
                    Start skill assessment
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold">{overallSkill}%</span>
                  <Badge variant="secondary">{BAND_LABEL[band(overallSkill)]}</Badge>
                </div>
                <Progress value={overallSkill} className="mt-3 h-2" />
                <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Skill gaps
                </p>
                <ul className="mt-2 space-y-2">
                  {weakSkills.map((s) => (
                    <li key={s.skill_id} className="flex items-center justify-between text-sm">
                      <span>{s.skills?.name}</span>
                      <Badge variant={band(s.score) === "attention" ? "destructive" : "outline"}>
                        {s.score}%
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Link to="/skills">
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                    View skill profile
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center gap-2">
              <RouteIcon className="text-accent size-4" />
              <h3 className="text-sm font-semibold">Recommended next step</h3>
            </div>
            {nextStep?.courses ? (
              <>
                <Link
                  to="/courses/$slug"
                  params={{ slug: nextStep.courses.slug }}
                  className="mt-3 block rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
                >
                  <p className="text-sm font-medium">{nextStep.courses.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{nextStep.reason}</p>
                </Link>
                <Link to="/roadmap">
                  <Button variant="ghost" size="sm" className="mt-3 w-full">
                    See full roadmap
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generate a roadmap built from your measured skills and the MoES catalog.
                </p>
                <Link to="/roadmap">
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                    Build my roadmap
                  </Button>
                </Link>
              </>
            )}
          </div>


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
