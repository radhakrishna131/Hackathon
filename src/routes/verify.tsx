import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ShieldX, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a certificate — Capacity Connect" },
      {
        name: "description",
        content:
          "Publicly verify the authenticity of any Capacity Connect certificate issued by the Ministry of Earth Sciences using its certificate number.",
      },
      { property: "og:title", content: "Verify a certificate — Capacity Connect" },
      {
        property: "og:description",
        content: "Check the authenticity of an MoES Capacity Connect certificate number.",
      },
    ],
  }),
  component: VerifyPage,
});

type Result =
  | { state: "idle" }
  | { state: "invalid" }
  | {
      state: "valid";
      certificate_no: string;
      issued_at: string;
      score: number;
      course: string;
    };

function VerifyPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>({ state: "idle" });
  const [busy, setBusy] = useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim().slice(0, 64);
    if (!value) return;
    setBusy(true);
    const { data } = await supabase
      .from("certificates")
      .select("certificate_no, issued_at, score, courses(title)")
      .eq("certificate_no", value)
      .maybeSingle();
    setBusy(false);
    if (!data) return setResult({ state: "invalid" });
    setResult({
      state: "valid",
      certificate_no: data.certificate_no,
      issued_at: data.issued_at,
      score: data.score,
      course: (data.courses as { title: string } | null)?.title ?? "—",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="gradient-accent flex size-9 items-center justify-center rounded-xl text-primary-foreground">
              <Waves className="size-5" />
            </span>
            <span className="font-display text-sm font-bold">CAPACITY CONNECT</span>
          </Link>
          <Link to="/auth">
            <Button size="sm" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-3xl font-bold">Certificate verification</h1>
        <p className="mt-2 text-muted-foreground">
          Enter the certificate number printed on the document (for example MoES-CC-2026-1001).
        </p>

        <form onSubmit={check} className="surface-card mt-8 space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="code">Certificate number</Label>
            <Input
              id="code"
              value={code}
              maxLength={64}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MoES-CC-2026-1001"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Verify
          </Button>
        </form>

        {result.state === "invalid" && (
          <div className="surface-card border-destructive/40 mt-6 flex items-start gap-3 p-6">
            <ShieldX className="text-destructive mt-0.5 size-5" />
            <div>
              <p className="font-semibold">No matching certificate</p>
              <p className="text-sm text-muted-foreground">
                This number is not present in the MoES registry.
              </p>
            </div>
          </div>
        )}

        {result.state === "valid" && (
          <div className="surface-card mt-6 p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-accent mt-0.5 size-5" />
              <div>
                <p className="font-semibold">Certificate verified</p>
                <p className="text-sm text-muted-foreground">Issued by the Ministry of Earth Sciences.</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Programme</dt>
                <dd className="font-medium">{result.course}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Certificate no.</dt>
                <dd className="font-medium">{result.certificate_no}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Issued on</dt>
                <dd className="font-medium">
                  {new Date(result.issued_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assessment score</dt>
                <dd className="font-medium">{result.score}%</dd>
              </div>
            </dl>
          </div>
        )}
      </main>
    </div>
  );
}
