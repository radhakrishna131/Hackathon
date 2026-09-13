import { supabase } from "@/integrations/supabase/client";

export type Skill = {
  id: string;
  name: string;
  description: string;
  category: string;
};

export type UserSkill = {
  skill_id: string;
  score: number;
  confidence: number;
  updated_at: string;
  skills: Skill | null;
};

export type SkillBand = "strong" | "developing" | "attention";

/** Deterministic competency banding — never AI-derived. */
export function band(score: number): SkillBand {
  if (score >= 80) return "strong";
  if (score >= 60) return "developing";
  return "attention";
}

export const BAND_LABEL: Record<SkillBand, string> = {
  strong: "Strong",
  developing: "Developing",
  attention: "Needs attention",
};

export async function fetchSkills() {
  const { data, error } = await supabase.from("skills").select("*").order("category");
  if (error) throw error;
  return (data ?? []) as Skill[];
}

export async function fetchMySkills(userId: string) {
  const { data, error } = await supabase
    .from("user_skills")
    .select("skill_id, score, confidence, updated_at, skills(id, name, description, category)")
    .eq("user_id", userId)
    .order("score", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as UserSkill[];
}

export async function fetchMySkillAttempts(userId: string) {
  const { data, error } = await supabase
    .from("skill_assessment_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCourseSkills(courseId: string) {
  const { data, error } = await supabase
    .from("course_skills")
    .select("id, importance, skill_id, skills(id, name, description, category)")
    .eq("course_id", courseId);
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    importance: string;
    skill_id: string;
    skills: Skill | null;
  }[];
}

export async function fetchMyRoadmap(userId: string) {
  const { data, error } = await supabase
    .from("learning_roadmaps")
    .select("*, roadmap_items(*, courses(id, title, slug, category, duration_hours), skills(id, name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
