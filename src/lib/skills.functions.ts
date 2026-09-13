import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway } from "@/lib/ai-gateway.server";

/* ------------------------------------------------------------------ */
/* Skill assessment                                                    */
/* ------------------------------------------------------------------ */

export type PublicQuestion = {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
  skill_id: string;
  skill_name: string;
};

/** Serves the question bank WITHOUT answer keys (keys stay server-side). */
export const getSkillAssessment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ questions: PublicQuestion[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("skill_assessment_questions")
      .select("id, question, options, difficulty, skill_id, skills(name)")
      .order("created_at");
    if (error) throw new Error("Could not load the competency assessment.");

    const rows = (data ?? []) as unknown as {
      id: string;
      question: string;
      options: string[];
      difficulty: string;
      skill_id: string;
      skills: { name: string } | null;
    }[];

    return {
      questions: rows.map((q) => ({
        id: q.id,
        question: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        difficulty: q.difficulty,
        skill_id: q.skill_id,
        skill_name: q.skills?.name ?? "General",
      })),
    };
  });

export const submitSkillAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        answers: z
          .array(
            z.object({
              question_id: z.string().uuid(),
              selected_option: z.number().int().min(0).max(9).nullable(),
            }),
          )
          .min(1)
          .max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = data.answers.map((a) => a.question_id);

    const { data: keys, error } = await supabaseAdmin
      .from("skill_assessment_questions")
      .select("id, skill_id, correct_option")
      .in("id", ids);
    if (error || !keys) throw new Error("Could not grade your assessment.");

    const keyMap = new Map(keys.map((k) => [k.id, k]));
    let correct = 0;
    const perSkill = new Map<string, { right: number; total: number }>();

    const graded = data.answers.map((a) => {
      const k = keyMap.get(a.question_id);
      const isCorrect = !!k && a.selected_option === k.correct_option;
      if (isCorrect) correct += 1;
      if (k) {
        const agg = perSkill.get(k.skill_id) ?? { right: 0, total: 0 };
        agg.total += 1;
        if (isCorrect) agg.right += 1;
        perSkill.set(k.skill_id, agg);
      }
      return { ...a, is_correct: isCorrect };
    });

    const total = data.answers.length;
    const score = Math.round((correct / total) * 100);

    const { data: attempt, error: aErr } = await supabaseAdmin
      .from("skill_assessment_attempts")
      .insert({
        user_id: context.userId,
        score,
        total_questions: total,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (aErr || !attempt) throw new Error("Could not save your attempt.");

    await supabaseAdmin.from("skill_assessment_answers").insert(
      graded.map((g) => ({
        attempt_id: attempt.id,
        question_id: g.question_id,
        selected_option: g.selected_option,
        is_correct: g.is_correct,
      })),
    );

    // Deterministic per-skill scores, then persist the skill profile.
    const { data: previous } = await supabaseAdmin
      .from("user_skills")
      .select("skill_id, score")
      .eq("user_id", context.userId);
    const prevMap = new Map((previous ?? []).map((p) => [p.skill_id, p.score]));

    const rows = [...perSkill.entries()].map(([skill_id, agg]) => ({
      user_id: context.userId,
      skill_id,
      score: Math.round((agg.right / agg.total) * 100),
      confidence: Math.min(100, agg.total * 25),
      updated_at: new Date().toISOString(),
    }));

    if (rows.length) {
      const { error: uErr } = await supabaseAdmin
        .from("user_skills")
        .upsert(rows, { onConflict: "user_id,skill_id" });
      if (uErr) throw new Error("Could not update your skill profile.");
    }

    return {
      attemptId: attempt.id,
      score,
      correct,
      total,
      skills: rows.map((r) => ({
        skill_id: r.skill_id,
        score: r.score,
        delta: r.score - (prevMap.get(r.skill_id) ?? 0),
        previous: prevMap.get(r.skill_id) ?? null,
      })),
    };
  });

/** Called after a course assessment so competency reflects real course outcomes. */
export const applyCourseAssessmentToSkills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ courseId: z.string().uuid(), score: z.number().int().min(0).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mapping } = await supabaseAdmin
      .from("course_skills")
      .select("skill_id, importance")
      .eq("course_id", data.courseId);
    if (!mapping?.length) return { updated: 0 };

    const { data: previous } = await supabaseAdmin
      .from("user_skills")
      .select("skill_id, score, confidence")
      .eq("user_id", context.userId);
    const prev = new Map((previous ?? []).map((p) => [p.skill_id, p]));

    const weight: Record<string, number> = { high: 1, medium: 0.75, low: 0.45 };
    const rows = mapping.map((m) => {
      const measured = Math.round(data.score * (weight[m.importance] ?? 0.75));
      const before = prev.get(m.skill_id);
      return {
        user_id: context.userId,
        skill_id: m.skill_id,
        score: Math.max(before?.score ?? 0, measured),
        confidence: Math.min(100, (before?.confidence ?? 40) + 20),
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabaseAdmin
      .from("user_skills")
      .upsert(rows, { onConflict: "user_id,skill_id" });
    if (error) throw new Error("Could not update your skill profile.");
    return { updated: rows.length };
  });

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export const generateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ goal: z.string().trim().min(3).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const [{ data: courses }, { data: links }, { data: mine }, { data: enrol }] = await Promise.all([
      sb.from("courses").select("id, title, slug, category, level, duration_hours").eq("is_published", true),
      sb.from("course_skills").select("course_id, skill_id, importance, skills(id, name, category)"),
      sb.from("user_skills").select("skill_id, score").eq("user_id", context.userId),
      sb.from("enrollments").select("course_id, progress").eq("user_id", context.userId),
    ]);

    const scoreOf = new Map((mine ?? []).map((m) => [m.skill_id, m.score]));
    const progressOf = new Map((enrol ?? []).map((e) => [e.course_id, e.progress]));
    const goal = data.goal.toLowerCase();

    type Link = {
      course_id: string;
      skill_id: string;
      importance: string;
      skills: { id: string; name: string; category: string } | null;
    };
    const rows = (links ?? []) as unknown as Link[];

    // Rank real courses by competency gap against the stated goal.
    const ranked = (courses ?? [])
      .map((c) => {
        const cls = rows.filter((l) => l.course_id === c.id);
        const gaps = cls.map((l) => {
          const have = scoreOf.get(l.skill_id) ?? 0;
          const w = l.importance === "high" ? 1.3 : l.importance === "medium" ? 1 : 0.6;
          return { link: l, gap: (100 - have) * w, have };
        });
        const gapScore = gaps.reduce((s, g) => s + g.gap, 0) / Math.max(1, gaps.length);
        const goalMatch =
          goal.includes(c.category.toLowerCase()) ||
          c.category.toLowerCase().includes(goal) ||
          cls.some(
            (l) =>
              goal.includes((l.skills?.name ?? "").toLowerCase()) ||
              goal.includes((l.skills?.category ?? "").toLowerCase()),
          )
            ? 60
            : 0;
        const weakest = [...gaps].sort((a, b) => b.gap - a.gap)[0];
        return { course: c, gapScore, goalMatch, weakest, total: gapScore + goalMatch };
      })
      .filter((r) => r.weakest)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    if (!ranked.length) return { ok: false as const, reason: "no_courses" };

    // AI writes only the human explanation; every id comes from the database.
    let reasons: Record<string, string> = {};
    try {
      const raw = await callGateway(
        [
          {
            role: "system",
            content:
              "You are Sankalp AI Tutor for India's Ministry of Earth Sciences. Write short, factual reasons. Answer with valid JSON only.",
          },
          {
            role: "user",
            content: `Learner goal: ${data.goal}.
For each programme below write one sentence explaining why it is the next step, referencing the competency and the learner's current score.
${ranked
  .map(
    (r, i) =>
      `${i + 1}. id=${r.course.id} | ${r.course.title} | key competency: ${r.weakest!.link.skills?.name} | current score: ${r.weakest!.have}%`,
  )
  .join("\n")}
Return {"reasons":[{"id":"course id","reason":"one sentence"}]}`,
          },
        ],
        true,
      );
      const parsed = JSON.parse(raw) as { reasons?: { id: string; reason: string }[] };
      reasons = Object.fromEntries((parsed.reasons ?? []).map((r) => [r.id, r.reason]));
    } catch {
      reasons = {};
    }

    const { data: roadmap, error: rErr } = await sb
      .from("learning_roadmaps")
      .insert({ user_id: context.userId, goal: data.goal })
      .select("id")
      .single();
    if (rErr || !roadmap) throw new Error("Could not save your roadmap.");

    const items = ranked.map((r, i) => {
      const progress = progressOf.get(r.course.id);
      const status =
        progress === undefined
          ? i === 0
            ? "recommended"
            : "locked"
          : progress >= 100
            ? "completed"
            : "in_progress";
      const fallback = `Current competency in ${r.weakest!.link.skills?.name ?? "this area"} is ${r.weakest!.have}% — this programme targets that gap.`;
      return {
        roadmap_id: roadmap.id,
        course_id: r.course.id,
        skill_id: r.weakest!.link.skill_id,
        position: i + 1,
        reason: reasons[r.course.id] ?? fallback,
        status,
      };
    });

    const { error: iErr } = await sb.from("roadmap_items").insert(items);
    if (iErr) throw new Error("Could not save your roadmap steps.");

    return { ok: true as const, roadmapId: roadmap.id, count: items.length };
  });

export const updateRoadmapItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        status: z.enum(["locked", "recommended", "in_progress", "completed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("roadmap_items")
      .update({ status: data.status })
      .eq("id", data.itemId);
    if (error) throw new Error("Could not update this step.");
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Competency-aware AI tutor (RAG grounded on real lesson content)     */
/* ------------------------------------------------------------------ */

const TUTOR_MODES = ["explain", "hint", "practice", "stuck", "summarize", "ask"] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];

const MODE_INSTRUCTION: Record<TutorMode, string> = {
  explain: "Explain the current concept clearly, adapted to the learner's competency level.",
  hint: "Give a guiding hint. Do not reveal the final answer immediately.",
  practice:
    "Generate one practice question based on the current lesson and the learner's weak skills, then give the answer under a line that starts with 'Answer:'.",
  stuck:
    "Identify the likely prerequisite knowledge gap, name the weak skill, and recommend one lesson from the supplied curriculum material.",
  summarize: "Summarise the supplied course material in short, clear points.",
  ask: "Answer the learner's question using the retrieved curriculum material.",
};

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        mode: z.enum(TUTOR_MODES).default("ask"),
        question: z.string().trim().max(4000).default(""),
        courseId: z.string().uuid().nullable().default(null),
        lessonId: z.string().uuid().nullable().default(null),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().trim().min(1).max(4000),
            }),
          )
          .max(12)
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const [{ data: profile }, { data: roles }, { data: skills }, { data: attempts }] =
      await Promise.all([
        sb.from("profiles").select("full_name, designation, department").eq("id", context.userId).maybeSingle(),
        sb.from("user_roles").select("role").eq("user_id", context.userId),
        sb
          .from("user_skills")
          .select("score, skills(name)")
          .eq("user_id", context.userId)
          .order("score", { ascending: true }),
        sb
          .from("attempts")
          .select("score, passed, created_at")
          .eq("user_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    let courseTitle = "not selected";
    let lessonTitle = "not selected";
    let lessonText = "";
    if (data.courseId) {
      const { data: c } = await sb.from("courses").select("title").eq("id", data.courseId).maybeSingle();
      courseTitle = c?.title ?? courseTitle;
    }
    if (data.lessonId) {
      const { data: l } = await sb
        .from("lessons")
        .select("title, content")
        .eq("id", data.lessonId)
        .maybeSingle();
      lessonTitle = l?.title ?? lessonTitle;
      lessonText = (l?.content ?? "").slice(0, 4000);
    }

    const { data: completed } = await sb
      .from("lesson_progress")
      .select("lessons(title)")
      .eq("user_id", context.userId)
      .limit(15);

    const skillRows = (skills ?? []) as unknown as { score: number; skills: { name: string } | null }[];
    const weak = skillRows.filter((s) => s.score < 60).map((s) => `${s.skills?.name} (${s.score}%)`);
    const profileLine =
      skillRows.map((s) => `${s.skills?.name}: ${s.score}%`).join(", ") || "no assessment taken yet";

    // Retrieval over real lesson content.
    const query = [data.question, lessonTitle, courseTitle, ...weak].filter(Boolean).join(" ").slice(0, 300);
    let ragContext = lessonText ? `Current lesson "${lessonTitle}":\n${lessonText}` : "";
    let lessons: { id: string; title: string }[] = [];
    try {
      const { data: chunks } = await sb.rpc("search_content_chunks", { _query: query, _limit: 5 });
      const rows = (chunks ?? []) as unknown as {
        lesson_id: string;
        content: string;
        metadata: { lesson_title?: string };
      }[];
      lessons = rows.map((r) => ({ id: r.lesson_id, title: r.metadata?.lesson_title ?? "Lesson" }));
      if (rows.length) {
        ragContext += `\n\nRetrieved MoES curriculum material:\n${rows
          .map((r) => `- [lesson_id ${r.lesson_id}] ${r.content.slice(0, 1200)}`)
          .join("\n")}`;
      }
    } catch {
      /* retrieval is best-effort; the tutor still answers from lesson text */
    }

    const system = `You are Sankalp AI Tutor for India's Ministry of Earth Sciences Capacity Connect platform.
Student context:
- Role: ${(roles ?? []).map((r) => r.role).join(", ") || "trainee"}
- Name: ${profile?.full_name || "learner"} (${profile?.designation || "officer"}, ${profile?.department || "MoES"})
- Current course: ${courseTitle}
- Current lesson: ${lessonTitle}
- Skill profile: ${profileLine}
- Weak skills: ${weak.join(", ") || "none identified"}
- Recent assessment scores: ${(attempts ?? []).map((a) => `${a.score}%`).join(", ") || "none"}
- Completed lessons: ${((completed ?? []) as unknown as { lessons: { title: string } | null }[])
      .map((c) => c.lessons?.title)
      .filter(Boolean)
      .join(", ") || "none"}

Retrieved curriculum material:
${ragContext || "No curriculum material was retrieved for this question."}

Rules:
1. Explain concepts clearly and accurately, adapted to the learner's competency level.
2. Prefer the supplied curriculum material as the source of truth.
3. Never invent course names, lesson names, policies or curriculum facts.
4. If the material does not contain the answer, say the available course material does not cover it.
5. For a hint, guide without revealing the answer.
6. Detect likely prerequisite knowledge gaps.
7. Recommend only lessons or courses supplied above.
8. Never reveal assessment answer keys.
9. Keep responses educational, concise and plain-text (short paragraphs or dashes).
10. Task: ${MODE_INSTRUCTION[data.mode]}`;

    if (data.mode === "stuck") {
      const raw = await callGateway(
        [
          { role: "system", content: system + "\nAnswer with valid JSON only." },
          {
            role: "user",
            content: `The learner is stuck${data.question ? ` on: ${data.question}` : ""}.
Available lessons you may recommend (use the exact id): ${lessons.map((l) => `${l.id} = ${l.title}`).join(" | ") || "none"}
Return {"type":"skill_gap","message":"one or two sentences","skill":"skill name or empty","recommendedLessonId":"an id from the list or empty","recommendedLessonTitle":"matching title or empty"}`,
          },
        ],
        true,
      );
      try {
        const parsed = JSON.parse(raw) as {
          type: string;
          message: string;
          skill?: string;
          recommendedLessonId?: string;
          recommendedLessonTitle?: string;
        };
        const valid = lessons.find((l) => l.id === parsed.recommendedLessonId);
        return {
          kind: "stuck" as const,
          message: parsed.message,
          skill: parsed.skill || weak[0]?.split(" (")[0] || "",
          recommendedLessonId: valid?.id ?? null,
          recommendedLessonTitle: valid?.title ?? null,
        };
      } catch {
        return {
          kind: "stuck" as const,
          message:
            "Review the current lesson material once more and focus on your weakest competency before continuing.",
          skill: weak[0]?.split(" (")[0] || "",
          recommendedLessonId: null,
          recommendedLessonTitle: null,
        };
      }
    }

    const userMsg =
      data.question ||
      (data.mode === "summarize"
        ? "Summarise the supplied material."
        : data.mode === "practice"
          ? "Give me a practice question."
          : "Explain the current concept.");

    const content = await callGateway([
      { role: "system", content: system },
      ...data.history,
      { role: "user", content: userMsg },
    ]);

    return { kind: "text" as const, content, grounded: lessons.length > 0 };
  });
