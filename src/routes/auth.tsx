import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Waves, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Capacity Connect" },
      {
        name: "description",
        content:
          "Sign in or create your Capacity Connect account to access MoES courses, assessments and certificates.",
      },
      { property: "og:title", content: "Sign in — Capacity Connect" },
      {
        property: "og:description",
        content: "Access MoES courses, assessments and certificates.",
      },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);
const nameSchema = z.string().trim().min(2, "Enter your full name").max(100);

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"trainee" | "trainer">("trainee");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z
      .object({ email: emailSchema, password: z.string().min(1) })
      .safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z
      .object({ email: emailSchema, password: passwordSchema, fullName: nameSchema })
      .safeParse({ email, password, fullName });
    if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.fullName, role },
      },
    });

    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    if (data.session && data.user) {
      setBusy(false);
      toast.success(`Account created as ${role}`);
      navigate({ to: "/dashboard" });
      return;
    }

    setBusy(false);
    toast.success("Check your inbox to confirm your email, then sign in.");
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) { toast.error("Google sign-in failed"); return; }
    // OAuth redirects the browser automatically — no navigate() needed
  };

  const forgot = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { toast.error("Enter your email address first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Password reset link sent");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="gradient-hero relative hidden flex-col justify-between p-12 lg:flex">
        <Link to="/" className="flex items-center gap-2.5 text-hero-foreground">
          <span className="flex size-9 items-center justify-center rounded-xl bg-hero-foreground/15">
            <Waves className="size-5" />
          </span>
          <span className="font-display text-sm font-bold">CAPACITY CONNECT</span>
        </Link>
        <div>
          <h2 className="max-w-md text-3xl font-bold text-hero-foreground">
            One account for courses, assessments and certification.
          </h2>
          <p className="mt-4 max-w-md text-hero-foreground/75">
            Trainees learn, trainers author and administrators govern — all under role-based access
            control.
          </p>
        </div>
        <p className="text-xs text-hero-foreground/60">Ministry of Earth Sciences · SIH26075</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold">Welcome to Capacity Connect</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue your learning journey.
          </p>

          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@moes.gov.in"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="button"
                  onClick={forgot}
                  className="text-primary text-xs hover:underline"
                >
                  Forgot password?
                </button>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Ananya Rao"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input
                    id="email2"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Password</Label>
                  <Input
                    id="password2"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>I am joining as</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as "trainee" | "trainer")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trainee">Trainee</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={google}>
            <svg viewBox="0 0 48 48" aria-hidden="true" className="size-4">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.9 17.6 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.15-3.2-.44-4.7H24v9h12.7c-.55 3-2.2 5.5-4.7 7.2l7.3 5.6c4.3-4 6.8-9.9 6.8-17.1z" />
              <path fill="#FBBC05" d="M10.4 28.1a14.6 14.6 0 0 1 0-9.2l-7.8-6.1a23.5 23.5 0 0 0 0 21.4l7.8-6.1z" />
              <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.3-5.6l-7.3-5.6c-2 1.4-4.7 2.3-8 2.3-6.4 0-11.7-4.4-13.6-10.4l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
            </svg>
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
