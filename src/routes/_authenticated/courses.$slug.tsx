import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  PlayCircle,
  Award,
  Layers,
  Gauge,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { recomputeProgress } from "@/lib/queries";
import { fetchCourseSkills, fetchMySkills, band, BAND_LABEL } from "@/lib/skills";


export const Route = createFileRoute("/_authenticated/courses/$slug")({
  head: () => ({
    meta: [
      { title: "Programme details — Capacity Connect" },
      {
        name: "description",
        content: "Modules, lessons, resources and the certification assessment for this MoES programme.",
      },
      { property: "og:title", content: "Programme details — Capacity Connect" },
      { property: "og:description", content: "Modules, lessons and certification assessment." },
    ],
  }),
  component: CourseDetail,
});

type Lesson = {
  id: string;
  title: string;
  content: string;
  duration_min: number;
  position: number;
  video_url: string | null;
  resource_url: string | null;
};
type Module = { id: string; title: string; position: number; lessons: Lesson[] };

function CourseDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, modules(*, lessons(*)), assessments(*)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", course?.id, user?.id],
    enabled: !!course && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("*")
        .eq("course_id", course!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: completed = [] } = useQuery({
    queryKey: ["lesson-progress", course?.id, user?.id],
    enabled: !!course && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("course_id", course!.id)
        .eq("user_id", user!.id);
      return (data ?? []).map((d) => d.lesson_id);
    },
  });

  const { data: courseSkills = [] } = useQuery({
    queryKey: ["course-skills", course?.id],
    enabled: !!course,
    queryFn: () => fetchCourseSkills(course!.id),
  });

  const { data: mySkills = [] } = useQuery({
    queryKey: ["my-skills", user?.id],
    enabled: !!user,
    queryFn: () => fetchMySkills(user!.id),
  });



  if (isLoading) {
    return (
      <AppShell title="Loading programme" breadcrumb="Home / Courses">
        <Skeleton className="h-64 w-full rounded-xl" />
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell title="Programme not found" breadcrumb="Home / Courses">
        <div className="surface-card p-12 text-center">
          <p className="font-medium">This programme is unavailable.</p>
          <Link to="/courses">
            <Button className="mt-4">Back to catalog</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const modules = ((course.modules ?? []) as Module[]).sort((a, b) => a.position - b.position);
  const allLessons = modules.flatMap((m) => m.lessons ?? []);
  const assessment = (course.assessments ?? [])[0] as { id: string; title: string; duration_min: number } | undefined;
  const done = completed.length;
  const pct = allLessons.length ? Math.round((done / allLessons.length) * 100) : 0;

  const enroll = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("enrollments")
      .insert({ user_id: user.id, course_id: course.id });
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "Enrolled in a new programme",
      body: course.title,
    });
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "enroll",
      entity: course.title,
    });
    toast.success("You are enrolled");
    qc.invalidateQueries({ queryKey: ["enrollment", course.id, user.id] });
    qc.invalidateQueries({ queryKey: ["my-enrollments", user.id] });
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const toggleLesson = async (lessonId: string, isDone: boolean) => {
    if (!user || !enrollment) { toast.error("Enrol in this programme first"); return; }
    if (isDone) {
      await supabase.from("lesson_progress").delete().eq("user_id", user.id).eq("lesson_id", lessonId);
    } else {
      await supabase
        .from("lesson_progress")
        .insert({ user_id: user.id, lesson_id: lessonId, course_id: course.id });
    }
    await recomputeProgress(user.id, course.id);
    qc.invalidateQueries({ queryKey: ["lesson-progress", course.id, user.id] });
    qc.invalidateQueries({ queryKey: ["enrollment", course.id, user.id] });
    qc.invalidateQueries({ queryKey: ["my-enrollments", user.id] });
  };

  return (
    <AppShell title={course.title} breadcrumb={`Home / Courses / ${course.category}`}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="surface-card p-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{course.category}</Badge>
              <Badge variant="outline">{course.level}</Badge>
              <Badge variant="outline">{course.duration_hours} hours</Badge>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{course.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(course.competencies as string[]).map((c) => (
                <span
                  key={c}
                  className="bg-accent-soft text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Curriculum
            </h2>
            <Accordion type="multiple" defaultValue={[modules[0]?.id ?? ""]} className="mt-3">
              {modules.map((m) => (
                <AccordionItem key={m.id} value={m.id}>
                  <AccordionTrigger className="text-left">
                    <span className="flex items-center gap-2">
                      <Layers className="size-4 shrink-0" /> {m.title}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({(m.lessons ?? []).length} lessons)
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {(m.lessons ?? [])
                        .sort((a, b) => a.position - b.position)
                        .map((l) => {
                          const isDone = completed.includes(l.id);
                          return (
                            <li key={l.id} className="rounded-lg border border-border p-3">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => toggleLesson(l.id, isDone)}
                                  aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                                  className="mt-0.5"
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="text-accent size-5" />
                                  ) : (
                                    <Circle className="size-5 text-muted-foreground" />
                                  )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">{l.title}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{l.content}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="size-3" /> {l.duration_min} min
                                    </span>
                                    {l.video_url && (
                                      <a
                                        href={l.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground flex items-center gap-1 font-medium underline underline-offset-2"
                                      >
                                        <PlayCircle className="size-3" /> Watch video
                                      </a>
                                    )}
                                    {l.resource_url && (
                                      <a
                                        href={l.resource_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground flex items-center gap-1 font-medium underline underline-offset-2"
                                      >
                                        <FileText className="size-3" /> Open PDF resource
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-card p-6">
            {enrollment ? (
              <>
                <p className="text-sm font-semibold">Your progress</p>
                <Progress value={pct} className="mt-3 h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {done} of {allLessons.length} lessons completed
                </p>
                {assessment && (
                  <Button
                    className="mt-5 w-full"
                    onClick={() => navigate({ to: "/assessments/$id", params: { id: assessment.id } })}
                  >
                    {pct >= 100 ? "Take certification exam" : "Attempt assessment"}
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Enrol in this programme</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Track lesson progress, attempt the assessment and earn a certificate.
                </p>
                <Button className="mt-4 w-full" onClick={enroll}>
                  Enrol now
                </Button>
              </>
            )}
          </div>

          {courseSkills.length > 0 && (
            <div className="surface-card p-6">
              <div className="flex items-center gap-2">
                <Gauge className="text-primary size-4" />
                <p className="text-sm font-semibold">Skill coverage</p>
              </div>
              <ul className="mt-4 space-y-4">
                {courseSkills.map((cs) => {
                  const mine = mySkills.find((m) => m.skill_id === cs.skill_id);
                  const score = mine?.score ?? 0;
                  return (
                    <li key={cs.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{cs.skills?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {mine ? `${score}% · ${BAND_LABEL[band(score)]}` : "not measured"}
                        </span>
                      </div>
                      <Progress value={score} className="mt-2 h-1.5" />
                      <p className="mt-1 text-[11px] text-muted-foreground capitalize">
                        {cs.importance} importance
                      </p>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/assistant">
                  <Button variant="outline" size="sm" className="w-full">
                    <Sparkles className="mr-1.5 size-3.5" /> Ask Sankalp AI Tutor
                  </Button>
                </Link>
                {mySkills.length === 0 && (
                  <Link to="/assessment/skill">
                    <Button variant="ghost" size="sm" className="w-full">
                      Measure my competency
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}


          {assessment && (
            <div className="surface-card p-6">
              <div className="flex items-center gap-2">
                <Award className="text-accent size-4" />
                <p className="text-sm font-semibold">Certification</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {assessment.title} · {assessment.duration_min} minutes · 60% to pass. Passing issues a
                numbered, publicly verifiable certificate.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
