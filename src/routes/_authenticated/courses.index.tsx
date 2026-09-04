import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, Layers } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCourses } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "Course catalog — Capacity Connect" },
      {
        name: "description",
        content:
          "Browse MoES capacity building programmes across oceanography, atmospheric science, geoscience, remote sensing and digital skills.",
      },
      { property: "og:title", content: "Course catalog — Capacity Connect" },
      { property: "og:description", content: "Browse MoES capacity building programmes." },
    ],
  }),
  component: CourseCatalog,
});

const PAGE_SIZE = 6;

function CourseCatalog() {
  const { data: courses = [], isLoading } = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category))).sort(),
    [courses],
  );

  const filtered = courses.filter(
    (c) =>
      (category === "all" || c.category === category) &&
      (level === "all" || c.level === level) &&
      (c.title + c.summary + c.category).toLowerCase().includes(q.trim().toLowerCase()),
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <AppShell title="Course catalog" breadcrumb="Home / Courses">
      <div className="surface-card mb-6 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search programmes, topics or categories"
            className="pl-9"
            maxLength={100}
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={level}
          onValueChange={(v) => {
            setLevel(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="surface-card p-12 text-center">
          <p className="font-medium">No programmes match your filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <Link
            key={c.id}
            to="/courses/$slug"
            params={{ slug: c.slug }}
            className="surface-card hover-lift flex flex-col p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{c.category}</Badge>
              <Badge variant="outline">{c.level}</Badge>
            </div>
            <h2 className="font-display mt-3 text-base font-semibold">{c.title}</h2>
            <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{c.summary}</p>
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" /> {c.duration_hours}h
              </span>
              <span className="flex items-center gap-1">
                <Layers className="size-3.5" /> {c.competencies.length} competencies
              </span>
            </div>
          </Link>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={current === 1} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {current} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </AppShell>
  );
}
