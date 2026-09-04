import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { fetchMyEnrollments } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/my-learning")({
  head: () => ({
    meta: [
      { title: "My learning — Capacity Connect" },
      { name: "description", content: "Track your enrolled MoES programmes, progress and completions." },
      { property: "og:title", content: "My learning — Capacity Connect" },
      { property: "og:description", content: "Track your enrolled programmes and progress." },
    ],
  }),
  component: MyLearning,
});

function MyLearning() {
  const { user } = useAuth();
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyEnrollments(user!.id),
  });

  const active = enrollments.filter((e) => e.progress < 100);
  const completed = enrollments.filter((e) => e.progress >= 100);

  const List = ({ items }: { items: typeof enrollments }) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.length === 0 && (
        <div className="surface-card p-10 text-center sm:col-span-2">
          <GraduationCap className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing here yet</p>
          <Link to="/courses">
            <Button className="mt-4">Browse catalog</Button>
          </Link>
        </div>
      )}
      {items.map((e) => {
        const c = e.courses as { title: string; slug: string; category: string; duration_hours: number } | null;
        if (!c) return null;
        return (
          <Link
            key={e.id}
            to="/courses/$slug"
            params={{ slug: c.slug }}
            className="surface-card hover-lift p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <Badge variant="secondary">{c.category}</Badge>
              <Badge variant={e.progress >= 100 ? "default" : "outline"}>{e.progress}%</Badge>
            </div>
            <h2 className="font-display mt-3 font-semibold">{c.title}</h2>
            <Progress value={e.progress} className="mt-4 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              Enrolled {new Date(e.enrolled_at).toLocaleDateString("en-IN")} · {c.duration_hours}h
            </p>
          </Link>
        );
      })}
    </div>
  );

  return (
    <AppShell title="My learning" breadcrumb="Home / My learning">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">In progress ({active.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-6">
            <List items={active} />
          </TabsContent>
          <TabsContent value="completed" className="mt-6">
            <List items={completed} />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
