import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Users, BookOpen, Award, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useRoleGuard } from "@/components/RoleGate";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Capacity Connect" },
      {
        name: "description",
        content: "Completion rates, enrolment trends, learning hours and assessment performance across MoES programmes.",
      },
      { property: "og:title", content: "Analytics — Capacity Connect" },
      { property: "og:description", content: "Institution-wide learning analytics." },
    ],
  }),
  component: Analytics,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Analytics() {
  const gate = useRoleGuard(["admin", "trainer"], { title: "Analytics", breadcrumb: "Home / Insights" });
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [courses, enrolments, attempts, certs, profiles] = await Promise.all([
        supabase.from("courses").select("id, title, category, duration_hours"),
        supabase.from("enrollments").select("course_id, progress, enrolled_at"),
        supabase.from("attempts").select("score, created_at"),
        supabase.from("certificates").select("id, issued_at"),
        supabase.from("profiles").select("id, created_at"),
      ]);

      const courseList = courses.data ?? [];
      const enrolList = enrolments.data ?? [];

      const popular = courseList
        .map((c) => ({
          name: c.title.split(" ").slice(0, 3).join(" "),
          enrolments: enrolList.filter((e) => e.course_id === c.id).length,
        }))
        .sort((a, b) => b.enrolments - a.enrolments)
        .slice(0, 6);

      const byCategory = Object.entries(
        courseList.reduce<Record<string, number>>((acc, c) => {
          acc[c.category] = (acc[c.category] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value }));

      const months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const key = d.toLocaleDateString("en-IN", { month: "short" });
        const inMonth = (iso: string) => {
          const t = new Date(iso);
          return t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear();
        };
        return {
          month: key,
          enrolments: enrolList.filter((e) => inMonth(e.enrolled_at)).length,
          users: (profiles.data ?? []).filter((p) => inMonth(p.created_at)).length,
        };
      });

      const completionRate = enrolList.length
        ? Math.round((enrolList.filter((e) => e.progress >= 100).length / enrolList.length) * 100)
        : 0;

      const learningHours = enrolList.reduce((sum, e) => {
        const c = courseList.find((x) => x.id === e.course_id);
        return sum + ((c?.duration_hours ?? 0) * e.progress) / 100;
      }, 0);

      const avgScore = (attempts.data ?? []).length
        ? Math.round(
            (attempts.data ?? []).reduce((s, a) => s + a.score, 0) / (attempts.data ?? []).length,
          )
        : 0;

      return {
        popular,
        byCategory,
        months,
        completionRate,
        learningHours,
        avgScore,
        users: (profiles.data ?? []).length,
        certs: (certs.data ?? []).length,
        courses: courseList.length,
      };
    },
  });

  if (gate) return gate;

  if (isLoading || !data) {
    return (
      <AppShell title="Analytics" breadcrumb="Home / Analytics">
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Analytics" breadcrumb="Home / Analytics">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Completion rate" value={`${data.completionRate}%`} />
        <StatCard icon={Users} label="Registered users" value={data.users} />
        <StatCard icon={BookOpen} label="Learning hours" value={data.learningHours.toFixed(1)} />
        <StatCard icon={Award} label="Avg. assessment score" value={`${data.avgScore}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="text-sm font-semibold">Enrolment & user growth</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Line type="monotone" dataKey="enrolments" stroke="var(--chart-1)" strokeWidth={2} />
                <Line type="monotone" dataKey="users" stroke="var(--chart-2)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="text-sm font-semibold">Most popular programmes</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.popular}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} interval={0} angle={-12} textAnchor="end" height={60} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="enrolments" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold">Catalog composition by discipline</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  label
                >
                  {data.byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
