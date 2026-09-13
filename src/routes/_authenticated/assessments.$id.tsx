import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer, CheckCircle2, XCircle, Award } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { applyCourseAssessmentToSkills } from "@/lib/skills.functions";


export const Route = createFileRoute("/_authenticated/assessments/$id")({
  head: () => ({
    meta: [
      { title: "Assessment — Capacity Connect" },
      { name: "description", content: "Timed multiple-choice competency assessment with instant scoring." },
      { property: "og:title", content: "Assessment — Capacity Connect" },
      { property: "og:description", content: "Timed competency assessment with instant scoring." },
    ],
  }),
  component: AssessmentPage,
});

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  position: number;
};

function AssessmentPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const syncSkills = useServerFn(applyCourseAssessmentToSkills);


  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<{
    score: number;
    passed: boolean;
    certificateNo: string | null;
  } | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [started, setStarted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["assessment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*, courses(id, title, slug), questions(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["attempts", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("attempts")
        .select("*")
        .eq("assessment_id", id)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!started || submitted || seconds === null) return;
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [started, seconds, submitted]);

  const questions = ((data?.questions ?? []) as Question[]).sort(
    (a, b) => a.position - b.position,
  );

  const submit = async () => {
    if (!user || !data) return;
    const correct = questions.filter((q) => answers[q.id] === q.correct_index).length;
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= (data.pass_score as number);

    await supabase.from("attempts").insert({
      assessment_id: id,
      user_id: user.id,
      score,
      passed,
      answers: questions.map((q) => ({ question_id: q.id, chosen: answers[q.id] ?? null })),
    });

    const course = data.courses as { id: string; title: string; slug: string } | null;
    let certificateNo: string | null = null;
    if (passed && course) {
      const { data: cert, error } = await supabase
        .from("certificates")
        .insert({ user_id: user.id, course_id: course.id, score })
        .select("certificate_no")
        .maybeSingle();
      if (!error) {
        certificateNo = cert?.certificate_no ?? null;
        await supabase.from("notifications").insert({
          user_id: user.id,
          title: "Certificate issued",
          body: `You passed ${course.title} with ${score}%. Certificate ID ${certificateNo ?? "issued"}.`,
        });
      } else {
        const { data: existing } = await supabase
          .from("certificates")
          .select("certificate_no")
          .eq("user_id", user.id)
          .eq("course_id", course.id)
          .order("issued_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        certificateNo = existing?.certificate_no ?? null;
      }
    }

    // Adaptive loop: course results feed the measurable competency profile.
    if (course) {
      try {
        await syncSkills({ data: { courseId: course.id, score } });
        qc.invalidateQueries({ queryKey: ["my-skills", user.id] });
        qc.invalidateQueries({ queryKey: ["roadmap", user.id] });
      } catch {
        /* competency sync is non-blocking — the assessment result still stands */
      }
    }

    setSubmitted({ score, passed, certificateNo });
    qc.invalidateQueries({ queryKey: ["attempts", id, user.id] });
    qc.invalidateQueries({ queryKey: ["certificates", user.id] });
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    toast[passed ? "success" : "error"](passed ? `Passed with ${score}%` : `Scored ${score}% — try again`);

  };

  if (isLoading) {
    return (
      <AppShell title="Assessment" breadcrumb="Home / Assessments">
        <Skeleton className="h-64 w-full rounded-xl" />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Assessment unavailable" breadcrumb="Home / Assessments">
        <div className="surface-card p-12 text-center">
          <p>This assessment could not be found.</p>
        </div>
      </AppShell>
    );
  }

  const course = data.courses as { title: string; slug: string } | null;
  const answeredCount = Object.keys(answers).length;

  return (
    <AppShell title={data.title as string} breadcrumb={`Home / ${course?.title ?? "Assessment"}`}>
      {!started && !submitted && (
        <div className="surface-card mx-auto max-w-xl p-8 text-center">
          <Award className="text-accent mx-auto size-10" />
          <h2 className="mt-4 text-xl font-bold">{data.title as string}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {questions.length} questions · {data.duration_min as number} minutes ·{" "}
            {data.pass_score as number}% to pass. Your answers are evaluated automatically.
          </p>
          {history.length > 0 && (
            <div className="mt-6 text-left">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Attempt history
              </p>
              <ul className="mt-2 space-y-2">
                {history.slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span>{new Date(a.created_at).toLocaleString("en-IN")}</span>
                    <Badge variant={a.passed ? "default" : "destructive"}>{a.score}%</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            className="mt-6 w-full"
            onClick={() => {
              setStarted(true);
              setSeconds((data.duration_min as number) * 60);
            }}
          >
            Start assessment
          </Button>
        </div>
      )}

      {started && !submitted && (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-3">
            {questions.map((q, i) => (
              <div key={q.id} className="surface-card p-6">
                <p className="text-xs font-semibold text-muted-foreground">Question {i + 1}</p>
                <p className="mt-1 font-medium">{q.prompt}</p>
                <RadioGroup
                  className="mt-4 space-y-2"
                  value={answers[q.id]?.toString() ?? ""}
                  onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
                >
                  {q.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
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
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Timer className="size-4" />
                {seconds !== null
                  ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
                  : "--:--"}
              </div>
              <Progress value={(answeredCount / questions.length) * 100} className="mt-4 h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {answeredCount} of {questions.length} answered
              </p>
              <Button className="mt-4 w-full" onClick={submit} disabled={answeredCount === 0}>
                Submit answers
              </Button>
              {seconds === 0 && (
                <p className="text-destructive mt-2 text-xs">Time is up — submit your answers.</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {submitted && (
        <div className="mx-auto max-w-2xl">
          <div className="surface-card p-8 text-center">
            {submitted.passed ? (
              <CheckCircle2 className="text-accent mx-auto size-12" />
            ) : (
              <XCircle className="text-destructive mx-auto size-12" />
            )}
            <h2 className="mt-4 text-2xl font-bold">{submitted.score}%</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {submitted.passed
                ? "Congratulations — your certificate has been issued."
                : `You need ${data.pass_score as number}% to pass. Review the explanations and try again.`}
            </p>
            {submitted.passed && submitted.certificateNo && (
              <div className="bg-muted mx-auto mt-4 inline-flex flex-col items-center rounded-lg px-4 py-3">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Certificate ID
                </span>
                <span className="mt-1 font-mono text-sm font-semibold">{submitted.certificateNo}</span>
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {submitted.passed && (
                <Link to="/certificates">
                  <Button>View certificate</Button>
                </Link>
              )}
              {course && (
                <Link to="/courses/$slug" params={{ slug: course.slug }}>
                  <Button variant="outline">Back to programme</Button>
                </Link>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {questions.map((q, i) => {
              const chosen = answers[q.id];
              const ok = chosen === q.correct_index;
              return (
                <div key={q.id} className="surface-card p-5">
                  <div className="flex items-start gap-2">
                    {ok ? (
                      <CheckCircle2 className="text-accent mt-0.5 size-4" />
                    ) : (
                      <XCircle className="text-destructive mt-0.5 size-4" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {i + 1}. {q.prompt}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Correct answer: {q.options[q.correct_index]}
                      </p>
                      {q.explanation && (
                        <p className="mt-1 text-xs text-muted-foreground">{q.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
