import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Route as RouteIcon, Target, CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchMyRoadmap, fetchMySkills, band } from "@/lib/skills";
import { generateRoadmap } from "@/lib/skills.functions";

export const Route = createFileRoute("/_authenticated/roadmap")({
  head: () => ({
    meta: [
      { title: "Learning roadmap — Capacity Connect" },
      {
        name: "description",
        content:
          "Your personalised MoES learning roadmap, ordered from your measured competency gaps to real programmes.",
      },
      { property: "og:title", content: "Learning roadmap — Capacity Connect" },
      { property: "og:description", content: "From learning content to measurable competency." },
    ],
  }),
  component: RoadmapPage,
});

const STATUS_ICON = {
  completed: CheckCircle2,
  in_progress: PlayCircle,
  recommended: Target,
  locked: Lock,
} as const;

function RoadmapPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const generate = useServerFn(generateRoadmap);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: roadmap, isLoading } = useQuery({
    queryKey: ["roadmap", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyRoadmap(user!.id),
  });

  const { data: skills = [] } = useQuery({
    queryKey: ["my-skills", user?.id],
    enabled: !!user,
    queryFn: () => fetchMySkills(user!.id),
  });

  const gaps = skills.filter((s) => band(s.score) !== "strong");

  const build = async () => {
    const g = goal.trim();
    if (g.length < 3) {
      toast.error("Describe your learning goal first");
      return;
    }
    setBusy(true);
    try {
      const res = await generate({ data: { goal: g } });
      if (!res.ok) {
        toast.error("No published programmes are available to build a roadmap yet.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["roadmap", user?.id] });
      toast.success(`Roadmap built with ${res.count} steps`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build your roadmap");
    } finally {
      setBusy(false);
    }
  };

  type Item = {
    id: string;
    position: number;
    reason: string;
    status: keyof typeof STATUS_ICON;
    courses: { id: string; title: string; slug: string; category: string; duration_hours: number } | null;
    skills: { id: string; name: string } | null;
  };
  const items = ((roadmap?.roadmap_items ?? []) as unknown as Item[]).sort(
    (a, b) => a.position - b.position,
  );


  return (
    <AppShell title="Personalised roadmap" breadcrumb="Home / Competency">
      <div className="surface-card p-6">
        <div className="flex items-center gap-2">
          <RouteIcon className="text-primary size-4" />
          <h2 className="text-sm font-semibold">Your learning goal</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Roadmap steps are ranked from your measured competency gaps and mapped to real MoES
          programmes.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={goal}
            maxLength={200}
            placeholder="e.g. Become proficient in Atmospheric Science"
            onChange={(e) => setGoal(e.target.value)}
          />
          <Button onClick={build} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Generate roadmap
          </Button>
        </div>
        {gaps.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Current gaps
            </span>
            {gaps.slice(0, 6).map((g) => (
              <Badge key={g.skill_id} variant={band(g.score) === "attention" ? "destructive" : "secondary"}>
                {g.skills?.name} · {g.score}%
              </Badge>
            ))}
          </div>
        )}
        {skills.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Tip:{" "}
            <Link to="/assessment/skill" className="underline">
              take the skill assessment
            </Link>{" "}
            first so your roadmap reflects measured competency.
          </p>
        )}
      </div>

      {isLoading && <Skeleton className="mt-6 h-64 w-full rounded-xl" />}

      {!isLoading && !roadmap && (
        <div className="surface-card mt-6 p-12 text-center">
          <p className="font-medium">No roadmap yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a goal above and Capacity Connect will order the programmes that close your gaps.
          </p>
        </div>
      )}

      {roadmap && (
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Your goal
          </p>
          <h2 className="font-display mt-1 text-xl font-bold">{roadmap.goal}</h2>

          <ol className="mt-6 space-y-4">
            {items.map((item) => {
              const Icon = STATUS_ICON[item.status] ?? Target;
              return (
                <li key={item.id} className="surface-card flex flex-wrap items-start gap-4 p-5">
                  <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {item.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.courses?.title ?? "Programme"}</h3>
                      <Badge variant="outline" className="capitalize">
                        <Icon className="mr-1 size-3" />
                        {item.status.replace("_", " ")}
                      </Badge>
                      {item.skills && <Badge variant="secondary">{item.skills.name}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                  </div>
                  {item.courses && (
                    <Link to="/courses/$slug" params={{ slug: item.courses.slug }}>
                      <Button size="sm" variant="outline">
                        Open programme
                      </Button>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </AppShell>
  );
}
