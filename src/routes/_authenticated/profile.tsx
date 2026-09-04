import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile settings — Capacity Connect" },
      { name: "description", content: "Manage your Capacity Connect profile, department and designation." },
      { property: "og:title", content: "Profile settings — Capacity Connect" },
      { property: "og:description", content: "Manage your profile details." },
    ],
  }),
  component: ProfilePage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  department: z.string().trim().max(120),
  designation: z.string().trim().max(120),
  bio: z.string().trim().max(500),
});

function ProfilePage() {
  const { user, profile, role, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: "", department: "", designation: "", bio: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name ?? "",
      department: profile?.department ?? "",
      designation: profile?.designation ?? "",
      bio: profile?.bio ?? "",
    });
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }
    if (!user) return;

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, email: user.email ?? "", ...parsed.data });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await refresh();
    toast.success("Profile updated");
  };

  return (
    <AppShell title="Profile settings" breadcrumb="Home / Profile">
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={save} className="surface-card space-y-4 p-6 lg:col-span-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">Department / Institute</Label>
              <Input
                id="department"
                value={form.department}
                maxLength={120}
                placeholder="INCOIS, Hyderabad"
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={form.designation}
                maxLength={120}
                placeholder="Scientist-D"
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Professional summary</Label>
            <Textarea
              id="bio"
              rows={4}
              maxLength={500}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Areas of expertise and current responsibilities"
            />
          </div>
          <Button type="submit" disabled={busy}>
            Save changes
          </Button>
        </form>

        <div className="surface-card h-fit p-6">
          <p className="text-sm font-semibold">Account</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium break-all">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <Badge variant="secondary" className="capitalize">
                  {role ?? "unassigned"}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </AppShell>
  );
}
