import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, ChevronRight, Medal, Trophy, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import {
  fetchLearningLeaderboard,
  fetchLearningPointSummary,
  fetchLeagueRecommendation,
  type LeaderboardPeriod,
} from "@/lib/learning-league";

export const Route = createFileRoute("/_authenticated/leaderboard")({ component: Leaderboard });

const labels: Record<LeaderboardPeriod, string> = {
  overall: "Overall",
  weekly: "Weekly",
  monthly: "Monthly",
  improved: "Most improved",
};

function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("overall");
  const league = useQuery({
    queryKey: ["learning-league", period],
    queryFn: () => fetchLearningLeaderboard(period),
  });
  const summary = useQuery({
    queryKey: ["learning-points", user?.id],
    enabled: !!user,
    queryFn: () => fetchLearningPointSummary(user!.id),
  });
  const recommendation = useQuery({
    queryKey: ["league-recommendation", user?.id],
    enabled: !!user,
    queryFn: () => fetchLeagueRecommendation(user!.id),
  });
  const mine = league.data?.find((entry) => entry.is_current_user);
  const leaders = league.data?.filter((entry) => entry.rank <= 3) ?? [];
  const next = mine ? league.data?.find((entry) => entry.rank === mine.rank - 1) : undefined;
  const gap = mine && next ? Math.max(0, next.total_points - mine.total_points) : null;

  return (
    <AppShell title="Learning League" breadcrumb="Home / Learning League">
      <section className="surface-card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-accent" />
              <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Sankalp Learning League
              </p>
            </div>
            <h2 className="font-display mt-3 text-3xl font-bold">Learn. Improve. Rise.</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Your progress earns recognition. Learning Points come from meaningful achievements—not
              simply time spent online.
            </p>
          </div>
          <Badge variant="secondary" className="px-3 py-1.5">
            {summary.data?.total ?? 0} LP earned
          </Badge>
        </div>
        <Tabs
          value={period}
          onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}
          className="mt-6"
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {(Object.keys(labels) as LeaderboardPeriod[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {labels[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </section>

      {league.isLoading ? (
        <Skeleton className="mt-6 h-96 rounded-xl" />
      ) : (
        <>
          {leaders.length > 0 && (
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              {leaders.map((entry) => (
                <div key={entry.rank} className="surface-card p-5 text-center">
                  <Medal className="mx-auto size-6 text-accent" />
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    RANK #{entry.rank}
                  </p>
                  <p className="mt-1 font-semibold">
                    {entry.display_name}
                    {entry.is_current_user ? " (You)" : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.total_points} LP</p>
                </div>
              ))}
            </section>
          )}
          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="surface-card p-5 lg:col-span-1">
              <p className="text-sm font-semibold">Your learning journey</p>
              {mine ? (
                <>
                  <p className="font-display mt-4 text-3xl font-bold">#{mine.rank}</p>
                  <p className="text-sm text-muted-foreground">
                    Your current position · {mine.league} League
                  </p>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">All-time points</dt>
                      <dd className="font-semibold">{mine.total_points} LP</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">This month</dt>
                      <dd className="font-semibold">+{summary.data?.monthly ?? 0} LP</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Competency growth</dt>
                      <dd className="font-semibold">+{mine.improvement_points} LP</dd>
                    </div>
                  </dl>
                  {gap !== null && (
                    <p className="mt-5 rounded-lg bg-secondary p-3 text-sm">
                      <span className="font-semibold">
                        {gap} LP to Rank #{next?.rank}.
                      </span>{" "}
                      Keep building your skills.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Your Learning League is just getting started. Complete a meaningful learning
                    activity to enter the rankings.
                  </p>
                </>
              )}
            </div>
            <div className="surface-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{labels[period]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ranked from verified Learning Points in UTC periods.
                  </p>
                </div>
                <TrendingUp className="size-5 text-primary" />
              </div>
              <ol className="mt-4 divide-y divide-border">
                {(league.data ?? []).map((entry) => (
                  <li
                    key={`${entry.rank}-${entry.display_name}`}
                    className={`flex items-center gap-3 py-3 text-sm ${entry.is_current_user ? "rounded-lg bg-primary-soft px-3" : ""}`}
                  >
                    <span className="w-8 font-semibold">#{entry.rank}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {entry.display_name}
                      {entry.is_current_user && " · You"}
                    </span>
                    <Badge variant="outline">
                      {period === "improved"
                        ? `+${entry.improvement_points} improvement`
                        : `${entry.total_points} LP`}
                    </Badge>
                  </li>
                ))}
              </ol>
              {!league.data?.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No qualifying learning achievements yet.
                </p>
              )}
            </div>
          </section>
          {recommendation.data && (
            <section className="surface-card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="size-4 text-accent" />
                  <p className="text-sm font-semibold">Your next opportunity</p>
                </div>
                <p className="mt-2 text-sm font-medium">{recommendation.data.title}</p>
                <p className="text-xs text-muted-foreground">
                  {recommendation.data.label} · potential +{recommendation.data.points} LP
                </p>
              </div>
              <Link to="/courses/$slug" params={{ slug: recommendation.data.slug }}>
                <Button>
                  Continue <ChevronRight className="size-4" />
                </Button>
              </Link>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
