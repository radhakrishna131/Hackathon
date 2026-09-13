import { useQuery } from "@tanstack/react-query";
import { Gauge, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { band, BAND_LABEL } from "@/lib/skills";

type Row = { user_id: string; score: number; skills: { name: string; category: string } | null };

export function CompetencyAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["competency-analytics"],
    queryFn: async () => {
      const [{ data: us }, { count: attemptCount }, { data: attemptUsers }, { data: items }] =
        await Promise.all([
          supabase.from("user_skills").select("user_id, score, skills(name, category)"),
          supabase.from("skill_assessment_attempts").select("id", { count: "exact", head: true }),
          supabase.from("skill_assessment_attempts").select("user_id"),
          supabase.from("roadmap_items").select("status"),
        ]);

      const rows = (us ?? []) as unknown as Row[];
      const byName = new Map<string, { total: number; n: number; category: string }>();
      rows.forEach((r) => {
        const name = r.skills?.name;
        if (!name) return;
        const agg = byName.get(name) ?? { total: 0, n: 0, category: r.skills?.category ?? "" };
        agg.total += r.score;
        agg.n += 1;
        byName.set(name, agg);
      });

      const averages = [...byName.entries()]
        .map(([name, a]) => ({ name, category: a.category, avg: Math.round(a.total / a.n), learners: a.n }))
        .sort((a, b) => b.avg - a.avg);

      const overall = averages.length
        ? Math.round(averages.reduce((s, a) => s + a.avg, 0) / averages.length)
        : 0;

      const roadmapItems = items ?? [];
      const roadmapDone = roadmapItems.filter((i) => i.status === "completed").length;

      return {
        averages,
        overall,
        learners: new Set(rows.map((r) => r.user_id)).size,
        attempts: attemptCount ?? 0,
        participants: new Set((attemptUsers ?? []).map((a) => a.user_id)).size,
        roadmapCompletion: roadmapItems.length
          ? Math.round((roadmapDone / roadmapItems.length) * 100)
          : 0,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!data || data.averages.length === 0) {
    return (
      <div className="surface-card p-8 text-center">
        <Gauge className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No competency data yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Metrics appear once learners complete the skill assessment.
        </p>
      </div>
    );
  }

  const strongest = data.averages.slice(0, 3);
  const weakest = [...data.averages].reverse().slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Average competency", value: `${data.overall}%` },
          { label: "Learners measured", value: data.learners },
          { label: "Assessment attempts", value: data.attempts },
          { label: "Roadmap completion", value: `${data.roadmapCompletion}%` },
        ].map((s) => (
          <div key={s.label} className="surface-card p-5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {s.label}
            </p>
            <p className="font-display mt-2 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary size-4" />
            <h3 className="text-sm font-semibold">Strongest competencies</h3>
          </div>
          <ul className="mt-4 space-y-3">
            {strongest.map((s) => (
              <li key={s.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant="secondary">{s.avg}%</Badge>
                </div>
                <Progress value={s.avg} className="mt-2 h-1.5" />
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-2">
            <TrendingDown className="text-destructive size-4" />
            <h3 className="text-sm font-semibold">Weakest competencies across learners</h3>
          </div>
          <ul className="mt-4 space-y-3">
            {weakest.map((s) => (
              <li key={s.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant={band(s.avg) === "attention" ? "destructive" : "secondary"}>
                    {s.avg}% · {BAND_LABEL[band(s.avg)]}
                  </Badge>
                </div>
                <Progress value={s.avg} className="mt-2 h-1.5" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="surface-card p-6">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Competency distribution</h3>
          <span className="text-xs text-muted-foreground">
            {data.participants} learners have taken the skill assessment
          </span>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.averages.map((s) => (
            <li key={s.name} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="font-semibold">{s.avg}%</span>
              </div>
              <Progress value={s.avg} className="mt-2 h-1.5" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {s.category} · {s.learners} learners
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
