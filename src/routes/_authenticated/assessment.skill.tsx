import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Brain, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { getSkillAssessment, submitSkillAssessment } from "@/lib/skills.functions";
import { fetchSkills, band, BAND_LABEL } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/assessment/skill")({
  head: () => ({
    meta: [
      { title: "AI skill assessment — Capacity Connect" },
      {
        name: "description",
        content:
          "Measure your earth-system competencies with the Capacity Connect skill assessment and build a personalised roadmap.",
      },
      { property: "og:title", content: "AI skill assessment — Capacity Connect" },
      { property: "og:description", content: "From learning content to measurable competency." },
    ],
  }),
  component: SkillAssessment,
});

type Result = Awaited<ReturnType<typeof submitSkillAssessment>>;

function SkillAssessment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const load = useServerFn(getSkillAssessment);
  const submitFn = useServerFn(submitSkillAssessment);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["skill-assessment"],
    queryFn: () => load({}),
  });
  const { data: skills = [] } = useQuery({ queryKey: ["skills"], queryFn: fetchSkills });
  const skillName = useMemo(
    () => Object.fromEntries(skills.map((s) => [s.id, s.name])),
    [skills],
  );

  const questions = data?.questions ?? [];
  const answered = Object.keys(answers).length;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await submitFn({
        data: {
          answers: questions.map((q) => ({
            question_id: q.id,
            selected_option: answers[q.id] ?? null,
          })),
        },
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: ["my-skills", user?.id] });
      qc.invalidateQueries({ queryKey: ["skill-attempts", user?.id] });
      toast.success(`Competency measured — overall ${res.score}%`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit your assessment");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Skill assessment" breadcrumb="Home / Competency">
        <Skeleton className="h-64 w-full rounded-xl" />
      </AppShell>
    );
  }

  if (isError || !questions.length) {
    return (
      <AppShell title="Skill assessment" breadcrumb="Home / Competency">
        <div className="surface-card p-12 text-center">
          <p className="font-medium">The competency question bank is not available right now.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You can continue learning from the course catalog in the meantime.
          </p>
          <Link to="/courses">
            <Button className="mt-4">Browse programmes</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  if (result) {
    return (
      <AppShell title="Your competency result" breadcrumb="Home / Competency">
        <div className="mx-auto max-w-2xl">
          <div className="surface-card p-8 text-center">
            <CheckCircle2 className="text-accent mx-auto size-12" />
            <h2 className="mt-4 text-3xl font-bold">{result.score}%</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.correct} of {result.total} correct across {result.skills.length} competencies.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/skills">
                <Button>View skill profile</Button>
              </Link>
              <Link to="/roadmap">
                <Button variant="outline">Build my roadmap</Button>
              </Link>
            </div>
          </div>

          <div className="surface-card mt-6 p-6">
            <h3 className="text-sm font-semibold">Measured competencies</h3>
            <ul className="mt-4 space-y-3">
              {[...result.skills]
                .sort((a, b) => b.score - a.score)
                .map((s) => (
                  <li key={s.skill_id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{skillName[s.skill_id] ?? "Skill"}</span>
                      <span className="flex items-center gap-2">
                        {s.previous !== null && s.delta !== 0 && (
                          <span className="text-xs text-muted-foreground">
                            <TrendingUp className="mr-1 inline size-3" />
                            {s.delta > 0 ? "+" : ""}
                            {s.delta}
                          </span>
                        )}
                        <Badge variant={band(s.score) === "attention" ? "destructive" : "secondary"}>
                          {s.score}% · {BAND_LABEL[band(s.score)]}
                        </Badge>
                      </span>
                    </div>
                    <Progress value={s.score} className="mt-2 h-2" />
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!started) {
    return (
      <AppShell title="AI skill assessment" breadcrumb="Home / Competency">
        <div className="surface-card mx-auto max-w-xl p-8 text-center">
          <Brain className="text-accent mx-auto size-10" />
          <h2 className="mt-4 text-xl font-bold">Measure your earth-system competencies</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {questions.length} questions across MoES competency areas. Scoring is automatic and your
            skill profile updates immediately — from learning content to measurable competency.
          </p>
          <Button className="mt-6 w-full" onClick={() => setStarted(true)}>
            Start assessment
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="AI skill assessment" breadcrumb="Home / Competency">
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-3">
          {questions.map((q, i) => (
            <div key={q.id} className="surface-card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Question {i + 1}</p>
                <Badge variant="secondary">{q.skill_name}</Badge>
                <Badge variant="outline" className="capitalize">
                  {q.difficulty}
                </Badge>
              </div>
              <p className="mt-2 font-medium">{q.question}</p>
              <RadioGroup
                className="mt-4 space-y-2"
                value={answers[q.id]?.toString() ?? ""}
                onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
              >
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                    <RadioGroupItem value={oi.toString()} id={`${q.id}-${oi}`} />
                    <Label htmlFor={`${q.id}-${oi}`} className="flex-1 cursor-pointer font-normal">
                      {opt}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="surface-card p-5">
            <p className="text-sm font-semibold">Progress</p>
            <Progress value={(answered / questions.length) * 100} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {answered} of {questions.length} answered
            </p>
            <Button className="mt-4 w-full" onClick={submit} disabled={busy || answered === 0}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Submit assessment
            </Button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
