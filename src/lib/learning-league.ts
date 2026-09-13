import { supabase } from "@/integrations/supabase/client";

export type LeaderboardPeriod = "overall" | "weekly" | "monthly" | "improved";

export type LeagueEntry = {
  rank: number;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  period_points: number;
  improvement_points: number;
  league: string;
  is_current_user: boolean;
};

export async function fetchLearningLeaderboard(period: LeaderboardPeriod, category?: string) {
  const { data, error } = await supabase.rpc("get_learning_leaderboard", {
    p_period: period,
    p_category: category ?? null,
    p_limit: 10,
    p_offset: 0,
  });
  if (error) throw error;
  return (data ?? []) as LeagueEntry[];
}

export async function fetchLearningPointSummary(userId: string) {
  const { data, error } = await supabase
    .from("learning_points")
    .select("points, created_at")
    .eq("user_id", userId);
  if (error) throw error;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const points = data ?? [];
  return {
    total: points.reduce((sum, point) => sum + point.points, 0),
    monthly: points
      .filter((point) => new Date(point.created_at) >= monthStart)
      .reduce((sum, point) => sum + point.points, 0),
  };
}

export async function fetchLeagueRecommendation(userId: string) {
  const [{ data: roadmap }, { data: enrolments }] = await Promise.all([
    supabase
      .from("learning_roadmaps")
      .select("roadmap_items(status, courses(title, slug))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("course_id, courses(title, slug, assessments(id, title))")
      .eq("user_id", userId),
  ]);

  const item = (
    roadmap?.roadmap_items as
      { status: string; courses: { title: string; slug: string } | null }[] | null
  )?.find((row) => row.status === "recommended" || row.status === "in_progress");
  if (item?.courses)
    return {
      title: item.courses.title,
      slug: item.courses.slug,
      points: 20,
      label: "Continue recommended roadmap item",
    };

  const enrolled = (enrolments ?? []) as unknown as {
    courses: { title: string; slug: string; assessments: { id: string; title: string }[] } | null;
  }[];
  const assessment = enrolled
    .map((row) => row.courses)
    .find((course) => course?.assessments?.length)?.assessments[0];
  const course = enrolled.find((row) => row.courses?.assessments?.length)?.courses;
  if (assessment && course)
    return {
      title: assessment.title,
      slug: course.slug,
      points: 25,
      label: "Pass this assessment",
    };
  return null;
}
