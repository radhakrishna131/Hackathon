import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Waves,
  Sparkles,
  ShieldCheck,
  BarChart3,
  Award,
  BookOpen,
  GraduationCap,
  Satellite,
  CloudSun,
  Mountain,
  Radar,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/lib/theme";
import { fetchCourses } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Capacity Connect — AI Learning Portal for MoES" },
      {
        name: "description",
        content:
          "Capacity Connect is the Ministry of Earth Sciences digital capacity building portal: curated earth-science courses, AI learning paths, assessments and verifiable certificates.",
      },
      { property: "og:title", content: "Capacity Connect — AI Learning Portal for MoES" },
      {
        property: "og:description",
        content:
          "Curated earth-science courses, AI learning paths, assessments and verifiable digital certificates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PARTNERS = [
  { icon: Waves, label: "INCOIS" },
  { icon: CloudSun, label: "IMD" },
  { icon: Mountain, label: "NCESS" },
  { icon: Satellite, label: "NRSC" },
  { icon: Radar, label: "IITM" },
  { icon: Cpu, label: "NCMRWF" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI learning companion",
    body: "Personalised roadmaps, skill-gap analysis and an always-on assistant grounded in the MoES curriculum.",
  },
  {
    icon: BookOpen,
    title: "Structured curriculum",
    body: "Modules, lessons, resources and assignments authored by domain trainers across earth-system disciplines.",
  },
  {
    icon: GraduationCap,
    title: "Competency assessments",
    body: "Timed MCQ exams with auto-evaluation, attempt history and objective scoring.",
  },
  {
    icon: Award,
    title: "Verifiable certificates",
    body: "Every completion issues a numbered certificate that anyone can verify publicly in seconds.",
  },
  {
    icon: BarChart3,
    title: "Institutional analytics",
    body: "Completion rates, learning hours, enrolment trends and popular programmes at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "Role-based access, row-level security and audited actions for admins, trainers and trainees.",
  },
];


function Landing() {
  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Nav */}
      <header className="bg-background/85 sticky top-0 z-40 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="gradient-accent text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Waves className="size-4" />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">CAPACITY CONNECT</span>
          </div>
          <nav className="text-muted-foreground hidden items-center gap-8 text-sm md:flex">
            <span className="text-foreground font-medium">Home</span>
            <Link to="/courses" className="hover:text-foreground">
              Courses
            </Link>
            <Link to="/verify" className="hover:text-foreground">
              Verify
            </Link>
            <a href="#features" className="hover:text-foreground">
              About
            </a>
          </nav>
          <ThemeToggle />

        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-10 pb-16 sm:px-6 lg:pt-16">
        <span className="text-muted/60 font-display pointer-events-none absolute top-10 left-6 text-[7rem] leading-none font-black select-none sm:text-[12rem]">
          °C
        </span>
        <span className="text-muted/60 font-display pointer-events-none absolute right-6 bottom-10 text-[7rem] leading-none font-black select-none sm:text-[12rem]">
          H₂O
        </span>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="relative mx-auto max-w-3xl">
            <span className="bg-card border-border absolute -top-6 -left-2 hidden rotate-[-12deg] rounded-2xl border px-4 py-3 sm:block">
              <Waves className="text-primary size-7" />
            </span>
            <span className="bg-card border-border absolute -right-2 top-16 hidden rotate-[10deg] rounded-2xl border px-4 py-3 sm:block">
              <Satellite className="text-primary size-7" />
            </span>
            <h1 className="font-display text-4xl leading-[0.95] font-black tracking-tight uppercase sm:text-6xl lg:text-7xl">
              Learn earth
              <br />
              science
              <br />
              anywhere
            </h1>
          </div>

          <div className="mt-6 flex justify-center">
            <span className="bg-primary text-primary-foreground rotate-[-3deg] rounded-2xl rounded-bl-sm px-5 py-2 text-sm font-bold">
              नमस्ते, trainee!
            </span>
          </div>

          <p className="text-muted-foreground mx-auto mt-6 max-w-md text-sm">
            Build national capability with courses, competency assessments and AI-guided learning
            paths from the Ministry of Earth Sciences.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="rounded-full px-8 font-semibold">
                Get Started
              </Button>
            </Link>
            <Link to="/courses">
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-muted rounded-full bg-transparent px-8"
              >
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        {/* Partner strip */}
        <div className="text-muted-foreground mx-auto mt-16 flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {PARTNERS.map((p) => (
            <span key={p.label} className="flex items-center gap-2 text-sm font-semibold">
              <p.icon className="size-5" /> {p.label}
            </span>
          ))}
        </div>
      </section>

      {/* Featured programmes */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display max-w-md text-3xl leading-tight font-black sm:text-4xl">
            Top earth-science
            <br />
            programmes
          </h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Curated pathways across oceanography, atmospheric science, geoscience, remote sensing
            and digital skills — authored by MoES domain trainers.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {courses.slice(0, 5).map((c, i) => (
            <Link
              key={c.id}
              to="/courses/$slug"
              params={{ slug: c.slug }}
              className="bg-card border-border hover:border-primary flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition-colors sm:gap-6 sm:p-5"
            >
              <span className="font-display w-8 text-lg font-black">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-40 flex-1">
                <p className="text-muted-foreground text-[11px] uppercase">Programme</p>
                <p className="font-semibold">{c.title}</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-muted-foreground text-[11px] uppercase">Category</p>
                <p className="font-semibold">{c.category}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-muted-foreground text-[11px] uppercase">Level</p>
                <p className="font-semibold">{c.level}</p>
              </div>
              <span className="bg-primary text-primary-foreground ml-auto rounded-full px-5 py-2 text-xs font-bold">
                {c.duration_hours}h · VIEW
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card border-border rounded-2xl border p-6">
              <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <dl className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {[
            ["6+", "Programmes across earth-system domains"],
            ["18+", "Lessons and resources"],
            ["100%", "Verifiable digital certificates"],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="font-display text-5xl font-black">{v}</dt>
              <dd className="text-muted-foreground mx-auto mt-2 max-w-45 text-xs">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA pills */}
      <section className="overflow-hidden py-16 text-center">
        <h2 className="font-display px-4 text-3xl font-black sm:text-5xl">
          What are you waiting for?
        </h2>
        <p className="text-muted-foreground mt-3 px-4 text-sm">
          The best way to build capability is to start learning today.
        </p>
        <div className="mt-10 flex items-center justify-center">
          <Link to="/auth">
            <span className="bg-primary text-primary-foreground rounded-full px-10 py-4 text-lg font-bold whitespace-nowrap">
              Get started
            </span>
          </Link>
        </div>

      </section>

      {/* Footer */}
      <footer className="px-4 pt-12 pb-6 text-center sm:px-6">
        <div className="flex items-center justify-center gap-2">
          <span className="gradient-accent text-primary-foreground flex size-7 items-center justify-center rounded-lg">
            <Waves className="size-4" />
          </span>
          <span className="font-display text-sm font-bold">CAPACITY CONNECT</span>
        </div>
        <p className="text-muted-foreground mx-auto mt-3 max-w-xs text-xs">
          AI-powered digital capacity building for the Ministry of Earth Sciences.
        </p>
        <div className="text-muted-foreground mt-6 flex justify-center gap-6 text-sm">
          <Link to="/courses" className="hover:text-foreground">
            Courses
          </Link>
          <Link to="/verify" className="hover:text-foreground">
            Verify
          </Link>
          <Link to="/auth" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
      <div className="bg-primary text-primary-foreground px-4 py-3 text-center text-xs font-medium sm:px-6">
        © {new Date().getFullYear()} Ministry of Earth Sciences · Capacity Connect
      </div>
    </div>
  );
}
