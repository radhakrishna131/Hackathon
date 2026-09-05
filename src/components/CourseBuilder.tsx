import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Plus, Trash2, FileText, Video, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type Lesson = {
  id: string;
  title: string;
  content: string;
  video_url: string | null;
  resource_url: string | null;
  duration_min: number;
  position: number;
};

type Module = { id: string; title: string; position: number; lessons: Lesson[] };

const urlSchema = z.string().trim().url("Enter a valid link starting with https://");

function LessonForm({ moduleId, onDone }: { moduleId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "",
    content: "",
    video_url: "",
    resource_url: "",
    duration_min: "15",
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = f.title.trim();
    if (title.length < 3) {
      toast.error("Lesson title must be at least 3 characters");
      return;
    }
    if (f.video_url.trim() && !urlSchema.safeParse(f.video_url).success) {
      toast.error("Enter a valid video link");
      return;
    }
    if (f.resource_url.trim() && !urlSchema.safeParse(f.resource_url).success) {
      toast.error("Enter a valid PDF/resource link");
      return;
    }
    setBusy(true);
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("module_id", moduleId);
    const { error } = await supabase.from("lessons").insert({
      module_id: moduleId,
      title,
      content: f.content.trim().slice(0, 5000),
      video_url: f.video_url.trim() || null,
      resource_url: f.resource_url.trim() || null,
      duration_min: Math.min(600, Math.max(1, Number(f.duration_min) || 15)),
      position: (count ?? 0) + 1,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setF({ title: "", content: "", video_url: "", resource_url: "", duration_min: "15" });
    toast.success("Lesson added");
    onDone();
  };

  return (
    <form onSubmit={save} className="bg-muted/50 mt-3 space-y-3 rounded-lg p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1.5">
          <Label>Lesson title</Label>
          <Input
            maxLength={150}
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="Reading tide gauge data"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Minutes</Label>
          <Input
            type="number"
            min={1}
            max={600}
            value={f.duration_min}
            onChange={(e) => setF({ ...f, duration_min: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Video link</Label>
        <Input
          value={f.video_url}
          onChange={(e) => setF({ ...f, video_url: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </div>
      <div className="space-y-1.5">
        <Label>PDF / resource link</Label>
        <Input
          value={f.resource_url}
          onChange={(e) => setF({ ...f, resource_url: e.target.value })}
          placeholder="https://example.gov.in/handbook.pdf"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          rows={3}
          maxLength={5000}
          value={f.content}
          onChange={(e) => setF({ ...f, content: e.target.value })}
          placeholder="Short lesson text learners will read"
        />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Add lesson
      </Button>
    </form>
  );
}

export function CourseBuilder({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [open, setOpen] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["course-builder", courseId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("id, title, position, lessons(*)")
        .eq("course_id", courseId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as Module[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["course-builder", courseId] });

  const addModule = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = moduleTitle.trim();
    if (title.length < 3) {
      toast.error("Module title must be at least 3 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("modules").insert({
      course_id: courseId,
      title,
      position: modules.length + 1,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setModuleTitle("");
    toast.success("Module added");
    refresh();
  };

  const removeModule = async (id: string) => {
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  };

  const removeLesson = async (id: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="size-4" /> Modules
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modules &amp; lessons — {courseTitle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={addModule} className="flex gap-2">
          <Input
            maxLength={150}
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
            placeholder="New module title"
          />
          <Button type="submit" disabled={busy} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
          </Button>
        </form>

        {isLoading && <Skeleton className="h-32 w-full rounded-xl" />}
        {!isLoading && modules.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No modules yet. Add your first module above, then add video and PDF lessons inside it.
          </p>
        )}

        <div className="space-y-4">
          {modules.map((m, i) => (
            <div key={m.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">
                  {i + 1}. {m.title}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => removeModule(m.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <ul className="mt-3 space-y-2">
                {(m.lessons ?? [])
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((l) => (
                    <li
                      key={l.id}
                      className="bg-muted/40 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{l.title}</span>
                        <span className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          {l.duration_min} min
                          {l.video_url && (
                            <span className="flex items-center gap-1">
                              <Video className="size-3" /> video
                            </span>
                          )}
                          {l.resource_url && (
                            <span className="flex items-center gap-1">
                              <FileText className="size-3" /> PDF
                            </span>
                          )}
                        </span>
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => removeLesson(l.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
              </ul>

              <LessonForm moduleId={m.id} onDone={refresh} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
