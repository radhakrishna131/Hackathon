import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRoleGuard } from "@/components/RoleGate";
import { useAuth, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "User management — Capacity Connect" },
      { name: "description", content: "Administer Capacity Connect users, roles and access levels." },
      { property: "og:title", content: "User management — Capacity Connect" },
      { property: "og:description", content: "Administer users, roles and access levels." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { role: myRole } = useAuth();
  const gate = useRoleGuard(["admin"], { title: "User management", breadcrumb: "Home / Administration" });
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["all-users"],
    enabled: myRole === "admin",
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: enrolments }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("enrollments").select("user_id"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roles ?? []).find((r) => r.user_id === p.id)?.role as AppRole | undefined,
        enrolments: (enrolments ?? []).filter((e) => e.user_id === p.id).length,
      }));
    },
  });

  const changeRole = async (userId: string, next: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: next });
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["all-users"] });
  };

  if (gate) return gate;
  if (myRole !== "admin") {
    return (
      <AppShell title="User management" breadcrumb="Home / Administration">
        <div className="surface-card p-12 text-center">
          <ShieldAlert className="text-destructive mx-auto size-8" />
          <p className="mt-3 font-medium">Administrator access required</p>
        </div>
      </AppShell>
    );
  }

  const rows = (data ?? []).filter((u) =>
    (u.full_name + u.email + (u.department ?? "")).toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <AppShell title="User management" breadcrumb="Home / Administration">
      <div className="surface-card mb-6 p-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or department"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Enrolments</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.department || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.enrolments}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role ?? "trainee"}
                      onValueChange={(v) => changeRole(u.id, v as AppRole)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trainee">Trainee</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No users match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
