import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Route as RouteIcon, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { fetchCourses, fetchMyEnrollments } from "@/lib/queries";
import { askAssistant, recommendCourses } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI assistant — Capacity Connect" },
      {
        name: "description",
        content: "Ask the Capacity Connect AI assistant, analyse your skill gaps and generate a personalised learning roadmap.",
      },
      { property: "og:title", content: "AI assistant — Capacity Connect" },
      { property: "og:description", content: "Skill-gap analysis and personalised learning roadmaps." },
    ],
  }),
  component: Assistant,
});

type Msg = { role: "user" | "assistant"; content: string };

function Assistant() {
  const { user, profile } = useAuth();
  const ask = useServerFn(askAssistant);
  const recommend = useServerFn(recommendCourses);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your Capacity Connect assistant. Ask me about ocean observation, weather prediction, seismology, remote sensing or which programme to take next.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim().slice(0, 4000);
    if (!text) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({ data: { messages: next.slice(-12) } });
      setMessages([...next, { role: "assistant", content: res.content }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The assistant is unavailable");
    } finally {
      setBusy(false);
    }
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
    <AppShell title="AI assistant" breadcrumb="Home / AI">
      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">Learning assistant</TabsTrigger>
          <TabsTrigger value="path">Skill gaps & roadmap</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6">
          <div className="surface-card flex h-[65vh] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
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
                placeholder="Ask about a concept, a programme, or how to prepare for an exam"
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
                  <h2 className="text-sm font-semibold">Personalised learning roadmap</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Built from your profile, enrolments and the MoES catalog.
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
                  <h3 className="text-sm font-semibold">Your roadmap</h3>
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
