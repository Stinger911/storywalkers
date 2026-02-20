import { A, useParams, useSearchParams } from "@solidjs/router";
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
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
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
  materialUrl: string;
  order: number;
  isActive: boolean;
};

type LessonTypeOption = {
  value: "video" | "text" | "task";
  label: string;
};

const LESSON_TYPE_OPTIONS: LessonTypeOption[] = [
  { value: "video", label: "video" },
  { value: "text", label: "text" },
  { value: "task", label: "task" },
];

export function AdminCourseLessons() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const courseId = createMemo(() => params.courseId || "");
  const courseTitle = createMemo(() => {
    const raw = searchParams.title;
    return typeof raw === "string" && raw.trim() ? raw.trim() : courseId();
  });

  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [items, setItems] = createSignal<LessonDraft[]>([]);
  const [pointerDraggingId, setPointerDraggingId] = createSignal<string | null>(null);
  const [pointerTargetId, setPointerTargetId] = createSignal<string | null>(null);
  const [pointerDragX, setPointerDragX] = createSignal(0);
  const [pointerDragY, setPointerDragY] = createSignal(0);

  const [newTitle, setNewTitle] = createSignal("");
  const [newType, setNewType] = createSignal<"video" | "text" | "task">("video");
  const [newContent, setNewContent] = createSignal("");
  const [newMaterialUrl, setNewMaterialUrl] = createSignal("");

  const [contentModalOpen, setContentModalOpen] = createSignal(false);
  const [contentModalLessonId, setContentModalLessonId] = createSignal<string | null>(null);
  const [contentModalValue, setContentModalValue] = createSignal("");
  const [contentModalMaterialUrl, setContentModalMaterialUrl] = createSignal("");
  const [contentModalInitialMaterialUrl, setContentModalInitialMaterialUrl] = createSignal("");

  const normalizeLessons = (lessons: AdminLesson[]) =>
    lessons
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        content: item.content,
        materialUrl: item.materialUrl ?? "",
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
        materialUrl: newMaterialUrl().trim() || null,
      });
      setNewTitle("");
      setNewContent("");
      setNewMaterialUrl("");
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
    setContentModalMaterialUrl(lesson.materialUrl);
    setContentModalInitialMaterialUrl(lesson.materialUrl);
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
    const isValidHttpUrl = (value: string) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    };

    const materialUrl = contentModalMaterialUrl().trim();
    const initialMaterialUrl = contentModalInitialMaterialUrl().trim();
    const materialChanged = materialUrl !== initialMaterialUrl;

    const payload: { content: string; materialUrl?: string | null } = { content };
    if (materialUrl === "") {
      payload.materialUrl = null;
    } else if (isValidHttpUrl(materialUrl)) {
      if (materialChanged) {
        payload.materialUrl = materialUrl;
      }
    } else if (materialChanged) {
      setError("Material URL must be a valid http(s) URL.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await patchAdminCourseLesson(courseId(), lessonId, payload);
      setItems((prev) =>
        prev.map((item) =>
          item.id === lessonId
            ? {
                ...item,
                content,
                materialUrl:
                  payload.materialUrl !== undefined ? (payload.materialUrl ?? "") : item.materialUrl,
              }
            : item,
        ),
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

  const reorderBetween = async (dragged: string, targetId: string) => {
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

  const onHandlePointerDown = (event: PointerEvent, lessonId: string) => {
    event.preventDefault();
    setPointerDraggingId(lessonId);
    setPointerTargetId(lessonId);
    setPointerDragX(event.clientX);
    setPointerDragY(event.clientY);
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event: PointerEvent) => {
    if (!pointerDraggingId()) return;
    setPointerDragX(event.clientX);
    setPointerDragY(event.clientY);
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const row = el?.closest?.("[data-lesson-row-id]") as HTMLElement | null;
    const rowId = row?.getAttribute("data-lesson-row-id");
    if (rowId) {
      setPointerTargetId(rowId);
    }
  };

  const onHandlePointerEnd = async (event: PointerEvent) => {
    const dragged = pointerDraggingId();
    const dropTargetId = pointerTargetId();
    const pointerTarget = event.currentTarget as HTMLElement | null;
    if (pointerTarget?.hasPointerCapture(event.pointerId)) {
      pointerTarget.releasePointerCapture(event.pointerId);
    }
    setPointerDraggingId(null);
    setPointerTargetId(null);
    setPointerDragX(0);
    setPointerDragY(0);
    if (!dragged || !dropTargetId || dragged === dropTargetId) return;
    await reorderBetween(dragged, dropTargetId);
  };

  const draggedLessonTitle = createMemo(() => {
    const id = pointerDraggingId();
    if (!id) return "";
    return items().find((item) => item.id === id)?.title || "";
  });

  const moveLesson = async (lessonId: string, direction: "up" | "down") => {
    const current = items();
    const index = current.findIndex((item) => item.id === lessonId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    const next = current.slice();
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    await reorderPersist(next);
  };

  return (
    <Page
      title="Course lessons"
      subtitle={`Manage lessons for course ${courseTitle()}`}
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
      <Show when={pointerDraggingId()}>
        <div
          class="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border/70 bg-card px-3 py-1 text-sm font-medium shadow-lg"
          style={{
            left: `${pointerDragX()}px`,
            top: `${pointerDragY()}px`,
          }}
        >
          {draggedLessonTitle()}
        </div>
      </Show>

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
          <TextField>
            <TextFieldLabel for="new-lesson-type">Type</TextFieldLabel>
            <Select
              value={LESSON_TYPE_OPTIONS.find((item) => item.value === newType())}
              onChange={(value) => {
                const raw = value?.value;
                if (raw === "video" || raw === "text" || raw === "task") {
                  setNewType(raw);
                }
              }}
              options={LESSON_TYPE_OPTIONS}
              optionValue={(option) => (option as LessonTypeOption).value}
              optionTextValue={(option) => (option as LessonTypeOption).label}
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {(props.item.rawValue as LessonTypeOption).label}
                </SelectItem>
              )}
            >
              <SelectHiddenSelect id="new-lesson-type" />
              <SelectTrigger aria-label="Type">
                <SelectValue<LessonTypeOption>>
                  {(state) =>
                    (state?.selectedOption() as LessonTypeOption | undefined)?.label || "video"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </TextField>
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
          <TextField>
            <TextFieldLabel for="new-lesson-material-url">Material URL</TextFieldLabel>
            <TextFieldInput
              id="new-lesson-material-url"
              value={newMaterialUrl()}
              onInput={(e) => setNewMaterialUrl(e.currentTarget.value)}
              placeholder="https://..."
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
                    data-lesson-row-id={lesson.id}
                  >
                    <div class="grid gap-3 md:grid-cols-[64px_1fr_140px_160px_auto] md:items-center">
                      <div class="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <span
                          class="cursor-grab select-none rounded border border-border/70 px-2 py-1"
                          classList={{ "cursor-grabbing": pointerDraggingId() === lesson.id }}
                          onPointerDown={(e) => onHandlePointerDown(e, lesson.id)}
                          onPointerMove={onHandlePointerMove}
                          onPointerUp={(e) => void onHandlePointerEnd(e)}
                          onPointerCancel={(e) => void onHandlePointerEnd(e)}
                          title="Drag to reorder"
                          aria-label={`Drag lesson ${lesson.id}`}
                        >
                          ::
                        </span>
                        <span>#{lesson.order}</span>
                      </div>
                      <input
                        class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                      <Select
                        value={LESSON_TYPE_OPTIONS.find((item) => item.value === lesson.type)}
                        onChange={(value) => {
                          const raw = value?.value;
                          if (raw === "video" || raw === "text" || raw === "task") {
                            setItems((prev) =>
                              prev.map((item) =>
                                item.id === lesson.id ? { ...item, type: raw } : item,
                              ),
                            );
                          }
                        }}
                        options={LESSON_TYPE_OPTIONS}
                        optionValue={(option) => (option as LessonTypeOption).value}
                        optionTextValue={(option) => (option as LessonTypeOption).label}
                        itemComponent={(props) => (
                          <SelectItem item={props.item}>
                            {(props.item.rawValue as LessonTypeOption).label}
                          </SelectItem>
                        )}
                      >
                        <SelectHiddenSelect />
                        <SelectTrigger aria-label={`Lesson type ${lesson.id}`}>
                          <SelectValue<LessonTypeOption>>
                            {(state) =>
                              (state?.selectedOption() as LessonTypeOption | undefined)?.label ||
                              lesson.type
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void moveLesson(lesson.id, "up")}
                          disabled={saving() || items().findIndex((item) => item.id === lesson.id) === 0}
                          title="Move up"
                          aria-label={`Move lesson ${lesson.id} up`}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void moveLesson(lesson.id, "down")}
                          disabled={
                            saving() ||
                            items().findIndex((item) => item.id === lesson.id) === items().length - 1
                          }
                          title="Move down"
                          aria-label={`Move lesson ${lesson.id} down`}
                        >
                          ↓
                        </Button>
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
          <TextField>
            <TextFieldLabel for="lesson-material-url-modal">Material URL</TextFieldLabel>
            <TextFieldInput
              id="lesson-material-url-modal"
              value={contentModalMaterialUrl()}
              onInput={(e) => setContentModalMaterialUrl(e.currentTarget.value)}
              placeholder="https://..."
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
