import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles,
  Send,
  Loader2,
  Route as RouteIcon,
  TriangleAlert,
  BookOpen,
  Lightbulb,
  HelpCircle,
  ListChecks,
  FileText,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { fetchCourses, fetchMyEnrollments } from "@/lib/queries";
import { fetchMySkills, band } from "@/lib/skills";
import { recommendCourses } from "@/lib/ai.functions";
import { askTutor, type TutorMode } from "@/lib/skills.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Sankalp AI Tutor — Capacity Connect" },
      {
        name: "description",
        content:
          "A competency-aware AI tutor grounded in MoES course material: explain, hint, practise, and close prerequisite gaps.",
      },
      { property: "og:title", content: "Sankalp AI Tutor — Capacity Connect" },
      {
        property: "og:description",
        content: "Curriculum-grounded tutoring that adapts to your measured competency.",
      },
    ],
  }),
  component: Assistant,
});

type Msg = { role: "user" | "assistant"; content: string };
type Stuck = {
  message: string;
  skill: string;
  recommendedLessonId: string | null;
  recommendedLessonTitle: string | null;
};

const ACTIONS: { mode: TutorMode; label: string; icon: typeof Lightbulb }[] = [
  { mode: "explain", label: "Explain", icon: BookOpen },
  { mode: "hint", label: "Hint", icon: Lightbulb },
  { mode: "practice", label: "Practice", icon: ListChecks },
  { mode: "summarize", label: "Summarise", icon: FileText },
  { mode: "stuck", label: "I'm stuck", icon: HelpCircle },
];

function Assistant() {
  const { user, profile } = useAuth();
  const tutor = useServerFn(askTutor);
  const recommend = useServerFn(recommendCourses);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Namaste! I'm Sankalp, your MoES learning tutor. Pick the programme you're studying, then ask me a question or use Explain, Hint, Practice or I'm stuck.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [courseId, setCourseId] = useState<string>("");
  const [lessonId, setLessonId] = useState<string>("");
  const [stuck, setStuck] = useState<Stuck | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [plan, setPlan] = useState<{
    recommendations: { title: string; reason: string }[];
    gaps: string[];
    roadmap: { step: string; detail: string }[];
  } | null>(null);
  const [planBusy, setPlanBusy] = useState(false);

  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyEnrollments(user!.id),
  });
  const { data: skills = [] } = useQuery({
    queryKey: ["my-skills", user?.id],
    enabled: !!user,
    queryFn: () => fetchMySkills(user!.id),
  });
  const weak = skills.filter((s) => band(s.score) !== "strong");

  const { data: lessons = [] } = useQuery({
    queryKey: ["course-lessons", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("lessons")
        .select("id, title, position, modules!inner(course_id)")
        .eq("modules.course_id", courseId)
        .order("position");
      return (data ?? []) as { id: string; title: string }[];
    },
  });

  const run = async (mode: TutorMode, text?: string) => {
    setBusy(true);
    setStuck(null);
    const history = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-8);
    if (text) setMessages((m) => [...m, { role: "user", content: text }]);
    try {
      const res = await tutor({
        data: {
          mode,
          question: text ?? "",
          courseId: courseId || null,
          lessonId: lessonId || null,
          history,
        },
      });
      if (res.kind === "stuck") {
        setStuck(res);
        setMessages((m) => [...m, { role: "assistant", content: res.message }]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              res.content +
              (res.grounded ? "" : "\n\n(Answered from general knowledge — no matching course material was found.)"),
          },
        ]);
      }
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "AI Tutor is temporarily unavailable. You can continue learning from the course material.",
      );
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim().slice(0, 4000);
    if (!text) return;
    setInput("");
    await run("ask", text);
  };

  const buildPlan = async () => {
    setPlanBusy(true);
    try {
      const res = await recommend({
        data: {
          interests: [profile?.designation, profile?.department, profile?.bio]
            .filter(Boolean)
            .join(", ")
            .slice(0, 500),
          completed: enrollments
            .map((e) => (e.courses as { title: string } | null)?.title ?? "")
            .filter(Boolean),
          catalog: courses.map((c) => ({ title: c.title, category: c.category })),
        },
      });
      setPlan(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build your roadmap");
    } finally {
      setPlanBusy(false);
    }
  };

  return (
    <AppShell title="Sankalp AI Tutor" breadcrumb="Home / AI Tutor">
      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">Tutor</TabsTrigger>
          <TabsTrigger value="path">Skill gaps & roadmap</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6 space-y-4">
          <div className="surface-card flex flex-wrap items-center gap-3 p-4">
            <Select
              value={courseId}
              onValueChange={(v) => {
                setCourseId(v);
                setLessonId("");
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Current programme" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={lessonId} onValueChange={setLessonId} disabled={!courseId}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Current lesson (optional)" />
              </SelectTrigger>
              <SelectContent>
                {lessons.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {weak.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Focus:</span>
                {weak.slice(0, 3).map((w) => (
                  <Badge key={w.skill_id} variant="secondary">
                    {w.skills?.name} · {w.score}%
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <Button
                key={a.mode}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(a.mode)}
              >
                <a.icon className="mr-1.5 size-3.5" />
                {a.label}
              </Button>
            ))}
          </div>

          {stuck && (
            <div className="surface-card border-warning/40 p-5">
              <div className="flex items-center gap-2">
                <TriangleAlert className="text-warning size-4" />
                <h3 className="text-sm font-semibold">You may have a prerequisite gap</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{stuck.message}</p>
              {stuck.skill && (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Skill: </span>
                  <span className="font-medium">{stuck.skill}</span>
                </p>
              )}
              {stuck.recommendedLessonTitle && (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Recommended lesson: </span>
                  <span className="font-medium">{stuck.recommendedLessonTitle}</span>
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Link to="/skills">
                  <Button size="sm" variant="outline">
                    View skill profile
                  </Button>
                </Link>
                <Link to="/roadmap">
                  <Button size="sm" variant="outline">
                    Update roadmap
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="surface-card flex h-[60vh] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.role === "user"
                        ? "bg-primary text-primary-foreground max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm"
                        : "bg-secondary text-secondary-foreground max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm whitespace-pre-wrap"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-border p-4">
              <Input
                value={input}
                maxLength={4000}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the current lesson, a concept, or how to prepare for an assessment"
              />
              <Button type="submit" disabled={busy} size="icon" aria-label="Send">
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="path" className="mt-6">
          <div className="surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="text-accent size-4" />
                  <h2 className="text-sm font-semibold">Quick skill-gap summary</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  For a measured, database-backed plan use the{" "}
                  <Link to="/roadmap" className="underline">
                    personalised roadmap
                  </Link>
                  .
                </p>
              </div>
              <Button onClick={buildPlan} disabled={planBusy}>
                {planBusy && <Loader2 className="mr-2 size-4 animate-spin" />} Analyse my skills
              </Button>
            </div>
          </div>

          {plan && (
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="surface-card p-6">
                <h3 className="text-sm font-semibold">Recommended programmes</h3>
                <ul className="mt-4 space-y-3">
                  {plan.recommendations.map((r) => (
                    <li key={r.title} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="surface-card p-6">
                <div className="flex items-center gap-2">
                  <TriangleAlert className="text-warning size-4" />
                  <h3 className="text-sm font-semibold">Skill gaps</h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {plan.gaps.map((g) => (
                    <Badge key={g} variant="secondary">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="surface-card p-6">
                <div className="flex items-center gap-2">
                  <RouteIcon className="text-primary size-4" />
                  <h3 className="text-sm font-semibold">Suggested sequence</h3>
                </div>
                <ol className="mt-4 space-y-3">
                  {plan.roadmap.map((s, i) => (
                    <li key={s.step} className="flex gap-3">
                      <span className="bg-primary-soft text-secondary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{s.step}</p>
                        <p className="text-xs text-muted-foreground">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
