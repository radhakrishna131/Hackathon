import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Brain, Gauge, TriangleAlert, History } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchMySkills, fetchMySkillAttempts, band, BAND_LABEL, type SkillBand } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/skills")({
  head: () => ({
    meta: [
      { title: "Skill profile — Capacity Connect" },
      {
        name: "description",
        content:
          "Your measured earth-system competency profile: strong skills, developing skills and gaps that need attention.",
      },
      { property: "og:title", content: "Skill profile — Capacity Connect" },
      { property: "og:description", content: "From learning content to measurable competency." },
    ],
  }),
  component: SkillProfile,
});

const GROUPS: { band: SkillBand; icon: typeof Gauge }[] = [
  { band: "strong", icon: Gauge },
  { band: "developing", icon: Brain },
  { band: "attention", icon: TriangleAlert },
];

function SkillProfile() {
  const { user } = useAuth();

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["my-skills", user?.id],
    enabled: !!user,
    queryFn: () => fetchMySkills(user!.id),
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["skill-attempts", user?.id],
    enabled: !!user,
    queryFn: () => fetchMySkillAttempts(user!.id),
  });

  const overall = skills.length
    ? Math.round(skills.reduce((s, x) => s + x.score, 0) / skills.length)
    : 0;

  if (isLoading) {
    return (
      <AppShell title="Skill profile" breadcrumb="Home / Competency">
        <Skeleton className="h-64 w-full rounded-xl" />
      </AppShell>
    );
  }

  if (!skills.length) {
    return (
      <AppShell title="Skill profile" breadcrumb="Home / Competency">
        <div className="surface-card p-12 text-center">
          <Brain className="text-accent mx-auto size-10" />
          <p className="mt-4 font-medium">You have not measured your competencies yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Take the skill assessment to build a measurable profile and unlock a personalised roadmap.
          </p>
          <Link to="/assessment/skill">
            <Button className="mt-4">Start skill assessment</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Skill profile"
      breadcrumb="Home / Competency"
      actions={
        <Link to="/assessment/skill">
          <Button size="sm">Re-assess</Button>
        </Link>
      }
    >
      <div className="surface-card p-6">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Overall competency
        </p>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-display text-4xl font-bold">{overall}%</span>
          <Badge variant={band(overall) === "attention" ? "destructive" : "secondary"}>
            {BAND_LABEL[band(overall)]}
          </Badge>
        </div>
        <Progress value={overall} className="mt-4 h-2" />
        <p className="mt-3 text-sm text-muted-foreground">
          Measured across {skills.length} MoES competencies from your assessment results.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {GROUPS.map(({ band: b, icon: Icon }) => {
          const items = skills.filter((s) => band(s.score) === b);
          return (
            <div key={b} className="surface-card p-6">
              <div className="flex items-center gap-2">
                <Icon className={b === "attention" ? "text-destructive size-4" : "text-primary size-4"} />
                <h2 className="text-sm font-semibold">{BAND_LABEL[b]}</h2>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              {items.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">Nothing in this band yet.</p>
              )}
              <ul className="mt-4 space-y-4">
                {items.map((s) => (
                  <li key={s.skill_id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.skills?.name}</span>
                      <span className="font-semibold">{s.score}%</span>
                    </div>
                    <Progress value={s.score} className="mt-2 h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">{s.skills?.category}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="surface-card mt-6 p-6">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Assessment history</h2>
        </div>
        {attempts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No competency assessments recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {attempts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>{new Date(a.created_at).toLocaleString("en-IN")}</span>
                <span className="text-muted-foreground">
                  {a.total_questions} questions
                  <Badge className="ml-3" variant="secondary">
                    {a.score}%
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
