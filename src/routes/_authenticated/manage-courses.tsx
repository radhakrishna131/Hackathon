import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Sparkles, Loader2, Users2, ShieldAlert, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRoleGuard } from "@/components/RoleGate";
import { CourseBuilder } from "@/components/CourseBuilder";
import { useAuth } from "@/lib/auth";
import { generateQuiz } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/manage-courses")({
  head: () => ({
    meta: [
      { title: "Manage courses — Capacity Connect" },
      {
        name: "description",
        content: "Author programmes, publish lessons, generate quizzes with AI and track learner progress.",
      },
      { property: "og:title", content: "Manage courses — Capacity Connect" },
      { property: "og:description", content: "Author programmes and track learner progress." },
    ],
  }),
  component: ManageCourses,
});

const courseSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(150),
  summary: z.string().trim().min(10, "Add a short summary").max(300),
  description: z.string().trim().max(2000),
  category: z.string().trim().min(2).max(80),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  duration_hours: z.coerce.number().min(1).max(200),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function ManageCourses() {
  const { user, role } = useAuth();
  const gate = useRoleGuard(["admin", "trainer"], { title: "Manage courses", breadcrumb: "Home / Trainer" });
  const qc = useQueryClient();
  const runGenerateQuiz = useServerFn(generateQuiz);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    description: "",
    category: "Oceanography",
    level: "Beginner",
    duration_hours: "6",
  });

  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [generated, setGenerated] = useState<
    { prompt: string; options: string[]; correct_index: number; explanation: string }[]
  >([]);

  const { data: myCourses = [], isLoading } = useQuery({
    queryKey: ["managed-courses", user?.id, role],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from("courses").select("*, enrollments(id, progress, user_id)");
      if (role !== "admin") query = query.eq("trainer_id", user!.id);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = courseSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }
    if (!user) return;

    setBusy(true);
    const { error } = await supabase.from("courses").insert({
      ...parsed.data,
      slug: `${slugify(parsed.data.title)}-${Math.random().toString(36).slice(2, 6)}`,
      trainer_id: user.id,
      is_published: true,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Programme created");
    setOpen(false);
    setForm({ ...form, title: "", summary: "", description: "" });
    qc.invalidateQueries({ queryKey: ["managed-courses"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Programme removed");
    qc.invalidateQueries({ queryKey: ["managed-courses"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
  };

  const runGeneration = async () => {
    const parsed = z.string().trim().min(3).max(200).safeParse(topic);
    if (!parsed.success) { toast.error("Enter a topic of at least 3 characters"); return; }
    setGenBusy(true);
    try {
      const res = await runGenerateQuiz({
        data: { topic: parsed.data, source: source.trim().slice(0, 8000), count: 5 },
      });
      setGenerated(res.questions);
      if (res.questions.length === 0) toast.error("The assistant returned no questions. Try again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quiz generation failed");
    } finally {
      setGenBusy(false);
    }
  };

  if (gate) return gate;
  if (role !== "admin" && role !== "trainer") {
    return (
      <AppShell title="Manage courses" breadcrumb="Home / Trainer">
        <div className="surface-card p-12 text-center">
          <ShieldAlert className="text-destructive mx-auto size-8" />
          <p className="mt-3 font-medium">Trainer access required</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask an administrator to grant you the trainer role.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Manage courses"
      breadcrumb="Home / Trainer workspace"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" /> New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create a programme</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t">Title</Label>
                <Input
                  id="t"
                  maxLength={150}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s">Summary</Label>
                <Input
                  id="s"
                  maxLength={300}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d">Description</Label>
                <Textarea
                  id="d"
                  rows={4}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="c">Category</Label>
                  <Input
                    id="c"
                    maxLength={80}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h">Hours</Label>
                  <Input
                    id="h"
                    type="number"
                    min={1}
                    max={200}
                    value={form.duration_hours}
                    onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Create programme
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses">My programmes</TabsTrigger>
          <TabsTrigger value="quiz">AI quiz builder</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-6 space-y-4">
          {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
          {!isLoading && myCourses.length === 0 && (
            <div className="surface-card p-12 text-center">
              <p className="font-medium">You haven't authored a programme yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the “New” button to publish your first course.
              </p>
            </div>
          )}
          {myCourses.map((c) => {
            const enrolments = (c.enrollments ?? []) as { id: string; progress: number }[];
            const avg = enrolments.length
              ? Math.round(enrolments.reduce((s, e) => s + e.progress, 0) / enrolments.length)
              : 0;
            return (
              <div key={c.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{c.category}</Badge>
                      <Badge variant="outline">{c.level}</Badge>
                      {!c.is_published && <Badge variant="destructive">Draft</Badge>}
                    </div>
                    <h2 className="font-display mt-2 font-semibold">{c.title}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{c.summary}</p>
                    <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Users2 className="size-3.5" /> {enrolments.length} learners · {avg}% average
                      progress
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CourseBuilder courseId={c.id} courseTitle={c.title} />
                    <Link to="/courses/$slug" params={{ slug: c.slug }}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="quiz" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="surface-card space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="text-accent size-4" />
                <h2 className="text-sm font-semibold">Generate MCQs from your material</h2>
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  maxLength={200}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Tsunami early warning protocols"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="src">Source material (optional)</Label>
                <Textarea
                  id="src"
                  rows={8}
                  maxLength={8000}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Paste lesson notes or document text to ground the questions"
                />
              </div>
              <Button onClick={runGeneration} disabled={genBusy} className="w-full">
                {genBusy && <Loader2 className="mr-2 size-4 animate-spin" />} Generate 5 questions
              </Button>
            </div>

            <div className="space-y-4">
              {generated.length === 0 && (
                <div className="surface-card p-10 text-center text-sm text-muted-foreground">
                  Generated questions will appear here, ready to review before publishing.
                </div>
              )}
              {generated.map((q, i) => (
                <div key={i} className="surface-card p-5">
                  <p className="text-sm font-medium">
                    {i + 1}. {q.prompt}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {q.options.map((o, oi) => (
                      <li
                        key={oi}
                        className={
                          oi === q.correct_index
                            ? "bg-accent-soft text-secondary-foreground rounded-md px-2 py-1 font-medium"
                            : "px-2 py-1 text-muted-foreground"
                        }
                      >
                        {o}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && (
                    <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
