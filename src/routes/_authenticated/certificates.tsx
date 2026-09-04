import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Printer, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchMyCertificates } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({
    meta: [
      { title: "Certificates — Capacity Connect" },
      {
        name: "description",
        content: "Download, print and share your verifiable MoES Capacity Connect certificates.",
      },
      { property: "og:title", content: "Certificates — Capacity Connect" },
      { property: "og:description", content: "Your verifiable MoES completion certificates." },
    ],
  }),
  component: Certificates,
});

function Certificates() {
  const { user, profile } = useAuth();
  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["certificates", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyCertificates(user!.id),
  });

  const verifyUrl = (no: string) =>
    typeof window === "undefined" ? "" : `${window.location.origin}/verify?no=${encodeURIComponent(no)}`;

  return (
    <AppShell
      title="Certificates"
      breadcrumb="Home / Certificates"
      actions={
        certs.length > 0 ? (
          <Button variant="outline" size="sm" className="gap-2 print:hidden" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
        ) : null
      }
    >
      {isLoading && <Skeleton className="h-56 w-full rounded-xl" />}

      {!isLoading && certs.length === 0 && (
        <div className="surface-card p-12 text-center">
          <Award className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 font-medium">No certificates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete a programme assessment with 60% or above to earn one.
          </p>
          <Link to="/courses">
            <Button className="mt-4">Browse programmes</Button>
          </Link>
        </div>
      )}

      <div className="space-y-8">
        {certs.map((c) => {
          const course = c.courses as { title: string; category: string } | null;
          return (
            <article
              key={c.id}
              className="surface-card border-primary/20 relative overflow-hidden border-2 p-8 sm:p-10"
            >
              <div className="gradient-accent absolute inset-x-0 top-0 h-1.5" />
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    Ministry of Earth Sciences · Government of India
                  </p>
                  <h2 className="font-display mt-4 text-2xl font-bold">Certificate of Completion</h2>
                  <p className="mt-6 text-sm text-muted-foreground">This is to certify that</p>
                  <p className="font-display mt-1 text-xl font-bold">{profile?.full_name || "Learner"}</p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    has successfully completed the programme
                  </p>
                  <p className="mt-1 text-lg font-semibold">{course?.title}</p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    with an assessment score of <span className="font-semibold text-foreground">{c.score}%</span>
                  </p>
                </div>

                <div className="text-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyUrl(c.certificate_no))}`}
                    alt={`QR code verifying certificate ${c.certificate_no}`}
                    width={140}
                    height={140}
                    loading="lazy"
                    className="rounded-lg border border-border bg-card p-1"
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground">Scan to verify</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
                <div className="text-xs text-muted-foreground">
                  <p>
                    Certificate no. <span className="font-semibold text-foreground">{c.certificate_no}</span>
                  </p>
                  <p className="mt-1">
                    Issued on {new Date(c.issued_at).toLocaleDateString("en-IN", { dateStyle: "long" })}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                    <Download className="size-4" /> Download PDF
                  </Button>
                  <Link to="/verify">
                    <Button variant="ghost" size="sm">
                      Verify
                    </Button>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
