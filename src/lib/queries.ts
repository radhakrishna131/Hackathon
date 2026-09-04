import { supabase } from "@/integrations/supabase/client";

export type Course = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  level: string;
  cover_url: string | null;
  duration_hours: number;
  competencies: string[];
  trainer_id: string | null;
  is_published: boolean;
  created_at: string;
};

export async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Course[];
}

export async function fetchCourseBySlug(slug: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("*, modules(*, lessons(*)), assessments(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyEnrollments(userId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, courses(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyCertificates(userId: string) {
  const { data, error } = await supabase
    .from("certificates")
    .select("*, courses(title, category)")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function recomputeProgress(userId: string, courseId: string) {
  const [{ count: total }, { count: done }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, modules!inner(course_id)", { count: "exact", head: true })
      .eq("modules.course_id", courseId),
    supabase
      .from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("course_id", courseId),
  ]);
  const pct = total && total > 0 ? Math.round(((done ?? 0) / total) * 100) : 0;
  await supabase
    .from("enrollments")
    .update({
      progress: pct,
      status: pct >= 100 ? "completed" : "active",
      completed_at: pct >= 100 ? new Date().toISOString() : null,
    })
    .eq("user_id", userId)
    .eq("course_id", courseId);
  return pct;
}
