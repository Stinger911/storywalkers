import { A, useParams } from "@solidjs/router";
import { createMemo, createSignal, createEffect, For, Show } from "solid-js";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from "../../components/ui/text-field";
import { showToast } from "../../components/ui/toast";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import {
  createAdminCourseLesson,
  deleteAdminCourseLesson,
  listAdminCourseLessons,
  patchAdminCourseLesson,
  reorderAdminCourseLessons,
  type AdminLesson,
} from "../../lib/adminApi";

type LessonDraft = {
  id: string;
  title: string;
  type: "video" | "text" | "task";
  content: string;
  order: number;
  isActive: boolean;
};

export function AdminCourseLessons() {
  const params = useParams();
  const courseId = createMemo(() => params.courseId || "");

  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [items, setItems] = createSignal<LessonDraft[]>([]);
  const [draggedId, setDraggedId] = createSignal<string | null>(null);

  const [newTitle, setNewTitle] = createSignal("");
  const [newType, setNewType] = createSignal<"video" | "text" | "task">("video");
  const [newContent, setNewContent] = createSignal("");

  const [contentModalOpen, setContentModalOpen] = createSignal(false);
  const [contentModalLessonId, setContentModalLessonId] = createSignal<string | null>(null);
  const [contentModalValue, setContentModalValue] = createSignal("");

  const normalizeLessons = (lessons: AdminLesson[]) =>
    lessons
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        content: item.content,
        order: item.order,
        isActive: item.isActive,
      }));

  const load = async () => {
    if (!courseId()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminCourseLessons(courseId());
      setItems(normalizeLessons(data.items));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (courseId()) {
      void load();
    }
  });

  const saveInline = async (lesson: LessonDraft) => {
    setSaving(true);
    setError(null);
    try {
      await patchAdminCourseLesson(courseId(), lesson.id, {
        title: lesson.title.trim(),
        type: lesson.type,
        content: lesson.content.trim(),
        order: lesson.order,
        isActive: lesson.isActive,
      });
      showToast({ title: "Lesson updated", variant: "success" });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      showToast({ title: "Failed to update lesson", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const createLesson = async () => {
    if (!newTitle().trim() || !newContent().trim()) {
      setError("Title and content are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAdminCourseLesson(courseId(), {
        title: newTitle().trim(),
        type: newType(),
        content: newContent().trim(),
      });
      setNewTitle("");
      setNewContent("");
      setNewType("video");
      showToast({ title: "Lesson created", variant: "success" });
      await load();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      showToast({ title: "Failed to create lesson", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const deactivateLesson = async (lessonId: string) => {
    if (!confirm("Deactivate this lesson?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAdminCourseLesson(courseId(), lessonId);
      showToast({ title: "Lesson deactivated", variant: "success" });
      await load();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      showToast({ title: "Failed to deactivate lesson", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const openContentModal = (lesson: LessonDraft) => {
    setContentModalLessonId(lesson.id);
    setContentModalValue(lesson.content);
    setContentModalOpen(true);
  };

  const saveContentModal = async () => {
    const lessonId = contentModalLessonId();
    if (!lessonId) return;
    const content = contentModalValue().trim();
    if (!content) {
      setError("Content is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await patchAdminCourseLesson(courseId(), lessonId, { content });
      setItems((prev) =>
        prev.map((item) => (item.id === lessonId ? { ...item, content } : item)),
      );
      showToast({ title: "Lesson content updated", variant: "success" });
      setContentModalOpen(false);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      showToast({ title: "Failed to update content", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const reorderPersist = async (nextItems: LessonDraft[]) => {
    const payload = {
      items: nextItems.map((item, index) => ({ lessonId: item.id, order: index })),
    };
    setSaving(true);
    setError(null);
    try {
      await reorderAdminCourseLessons(courseId(), payload);
      setItems(nextItems.map((item, index) => ({ ...item, order: index })));
      showToast({ title: "Order updated", variant: "success" });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      showToast({ title: "Failed to reorder", description: message, variant: "error" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const onDrop = async (targetId: string) => {
    const dragged = draggedId();
    if (!dragged || dragged === targetId) return;
    const current = items();
    const from = current.findIndex((item) => item.id === dragged);
    const to = current.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const next = current.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await reorderPersist(next);
  };

  return (
    <Page
      title="Course lessons"
      subtitle={`Manage lessons for course ${courseId()}`}
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/courses">Courses</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Lessons</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <A href="/admin/courses" class="text-sm text-primary underline">
          Back to courses
        </A>
      }
    >
      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <SectionCard title="Create lesson">
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <TextField>
            <TextFieldLabel for="new-lesson-title">Title</TextFieldLabel>
            <TextFieldInput
              id="new-lesson-title"
              value={newTitle()}
              onInput={(e) => setNewTitle(e.currentTarget.value)}
              placeholder="Lesson title"
            />
          </TextField>
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="new-lesson-type">
              Type
            </label>
            <select
              id="new-lesson-type"
              class="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={newType()}
              onChange={(e) => setNewType(e.currentTarget.value as "video" | "text" | "task")}
            >
              <option value="video">video</option>
              <option value="text">text</option>
              <option value="task">task</option>
            </select>
          </div>
        </div>
        <div class="mt-3">
          <TextField>
            <TextFieldLabel for="new-lesson-content">Content</TextFieldLabel>
            <TextFieldTextArea
              id="new-lesson-content"
              rows={5}
              value={newContent()}
              onInput={(e) => setNewContent(e.currentTarget.value)}
              placeholder="Lesson content"
            />
          </TextField>
        </div>
        <div class="mt-3">
          <Button onClick={() => void createLesson()} disabled={saving()}>
            Create lesson
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Lessons"
        description="Drag rows to reorder. Drop triggers save."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        }
      >
        <Show when={!loading()} fallback={<div class="mt-4 text-sm">Loading…</div>}>
          <Show
            when={items().length > 0}
            fallback={
              <div class="mt-4 rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                No lessons yet.
              </div>
            }
          >
            <div class="mt-4 space-y-2">
              <For each={items()}>
                {(lesson) => (
                  <div
                    class="rounded-xl border border-border/70 bg-card p-3"
                    draggable
                    onDragStart={() => setDraggedId(lesson.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => void onDrop(lesson.id)}
                  >
                    <div class="grid gap-3 md:grid-cols-[60px_1fr_140px_160px_auto] md:items-center">
                      <div class="text-sm font-semibold text-muted-foreground">
                        #{lesson.order}
                      </div>
                      <TextField>
                        <TextFieldInput
                          value={lesson.title}
                          onInput={(e) =>
                            setItems((prev) =>
                              prev.map((item) =>
                                item.id === lesson.id
                                  ? { ...item, title: e.currentTarget.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </TextField>
                      <select
                        class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={lesson.type}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((item) =>
                              item.id === lesson.id
                                ? { ...item, type: e.currentTarget.value as "video" | "text" | "task" }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="video">video</option>
                        <option value="text">text</option>
                        <option value="task">task</option>
                      </select>
                      <div class="flex items-center gap-2">
                        <label class="text-xs text-muted-foreground">Active</label>
                        <input
                          type="checkbox"
                          checked={lesson.isActive}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((item) =>
                                item.id === lesson.id
                                  ? { ...item, isActive: e.currentTarget.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        <Badge variant={lesson.isActive ? "success" : "warning"}>
                          {lesson.isActive ? "active" : "inactive"}
                        </Badge>
                      </div>
                      <div class="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openContentModal(lesson)}>
                          Content
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void saveInline(lesson)}
                          disabled={saving()}
                        >
                          Save
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void deactivateLesson(lesson.id)}
                          disabled={saving() || !lesson.isActive}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </SectionCard>

      <Dialog open={contentModalOpen()} onOpenChange={setContentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit content</DialogTitle>
            <DialogDescription>
              Simple text content editor for this lesson.
            </DialogDescription>
          </DialogHeader>
          <TextField>
            <TextFieldLabel for="lesson-content-modal">Content</TextFieldLabel>
            <TextFieldTextArea
              id="lesson-content-modal"
              rows={12}
              value={contentModalValue()}
              onInput={(e) => setContentModalValue(e.currentTarget.value)}
            />
          </TextField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContentModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveContentModal()} disabled={saving()}>
              Save content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
