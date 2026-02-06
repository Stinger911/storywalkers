import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from "../../components/ui/text-field";
import { listCategories, type Category } from "../../lib/adminApi";
import {
  answerQuestion,
  getQuestion,
  type AnswerQuestionRequest,
  type Question,
} from "../../lib/questionsApi";

export function AdminQuestionDetail() {
  const params = useParams();
  const [question, setQuestion] = createSignal<Question | null>(null);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);
  const [form, setForm] = createSignal({
    text: "",
    videoUrl: "",
    publishToLibrary: false,
    library: {
      status: "published",
      categoryId: "",
      title: "",
      content: "",
      keywords: "",
    },
  });

  const categoryLookup = createMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories()) {
      map.set(category.id, category.name);
    }
    return map;
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (!params.id) {
        throw new Error("No question ID provided.");
      }
      const [questionData, categoriesData] = await Promise.all([
        getQuestion(params.id),
        listCategories(),
      ]);
      setQuestion(questionData);
      setCategories(categoriesData.items);
      setForm({
        text: questionData.answer?.text ?? "",
        videoUrl: questionData.answer?.videoUrl ?? "",
        publishToLibrary: questionData.answer?.publishToLibrary ?? false,
        library: {
          status: "published",
          categoryId: questionData.categoryId ?? "",
          title: questionData.title ?? "",
          content: questionData.answer?.text ?? questionData.body ?? "",
          keywords: "",
        },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void load();
  });

  const submit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!params.id) {
        throw new Error("No question ID provided.");
      }
      const payload = form();
      if (!payload.text.trim()) {
        throw new Error("Answer text is required.");
      }
      if (payload.publishToLibrary) {
        if (!payload.library.title.trim()) {
          throw new Error("Library title is required.");
        }
        if (!payload.library.categoryId.trim()) {
          throw new Error("Library category is required.");
        }
        if (!payload.library.content.trim()) {
          throw new Error("Library content is required.");
        }
      }
      const request: AnswerQuestionRequest = {
        text: payload.text.trim(),
        videoUrl: payload.videoUrl.trim() || undefined,
        publishToLibrary: payload.publishToLibrary,
        library: payload.publishToLibrary
          ? {
              status: payload.library.status as "draft" | "published",
              categoryId: payload.library.categoryId.trim(),
              title: payload.library.title.trim(),
              content: payload.library.content.trim(),
              keywords: payload.library.keywords
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            }
          : undefined,
      };
      const response = await answerQuestion(params.id, request);
      setSuccess(
        response.libraryEntry
          ? `Answer saved and library entry ${response.libraryEntry.id} updated.`
          : "Answer saved.",
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Answer question"
      subtitle="Review the student question and craft the official answer."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/questions">Questions</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Answer</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <A href="/admin/questions" class="text-sm text-primary underline">
          Back to questions
        </A>
      }
    >

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>
      <Show when={success()}>
        <div class="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          {success()}
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
        <Show when={question()}>
          <SectionCard title="Question">
            <div class="text-xs text-muted-foreground">
              {categoryLookup().get(question()?.categoryId ?? "") ||
                question()?.categoryId}
            </div>
            <h3 class="text-xl font-semibold">{question()?.title}</h3>
            <p class="mt-2 text-sm text-muted-foreground">
              {question()?.body || "No additional details"}
            </p>
            <div class="mt-4 text-sm text-muted-foreground">
              Status: {question()?.status === "answered" ? "Answered" : "New"}
            </div>
          </SectionCard>

          <SectionCard title="Answer">
            <div class="mt-4 grid gap-4">
              <TextField>
                <TextFieldLabel for="answer-text">Answer text</TextFieldLabel>
                <TextFieldTextArea
                  id="answer-text"
                  value={form().text}
                  onInput={(e) =>
                    setForm({ ...form(), text: e.currentTarget.value })
                  }
                  placeholder="Write the response for the student"
                />
              </TextField>
              <TextField>
                <TextFieldLabel for="answer-video">Video URL</TextFieldLabel>
                <TextFieldInput
                  id="answer-video"
                  value={form().videoUrl}
                  onInput={(e) =>
                    setForm({ ...form(), videoUrl: e.currentTarget.value })
                  }
                  placeholder="Optional video link"
                />
              </TextField>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form().publishToLibrary}
                  onChange={(e) =>
                    setForm({
                      ...form(),
                      publishToLibrary: e.currentTarget.checked,
                    })
                  }
                />
                Publish this answer to the library
              </label>
            </div>
          </SectionCard>

          <Show when={form().publishToLibrary}>
            <SectionCard title="Library entry">
              <div class="mt-4 grid gap-4">
                <TextField>
                  <TextFieldLabel for="library-title">Title</TextFieldLabel>
                  <TextFieldInput
                    id="library-title"
                    value={form().library.title}
                    onInput={(e) =>
                      setForm({
                        ...form(),
                        library: {
                          ...form().library,
                          title: e.currentTarget.value,
                        },
                      })
                    }
                  />
                </TextField>
                <div class="grid gap-2">
                  <label class="text-sm font-medium" for="library-category">
                    Category
                  </label>
                  <select
                    id="library-category"
                    class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form().library.categoryId}
                    onChange={(e) =>
                      setForm({
                        ...form(),
                        library: {
                          ...form().library,
                          categoryId: e.currentTarget.value,
                        },
                      })
                    }
                  >
                    <option value="">Select category</option>
                    {categories().map((category) => (
                      <option value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <TextField>
                  <TextFieldLabel for="library-content">Content</TextFieldLabel>
                  <TextFieldTextArea
                    id="library-content"
                    value={form().library.content}
                    onInput={(e) =>
                      setForm({
                        ...form(),
                        library: {
                          ...form().library,
                          content: e.currentTarget.value,
                        },
                      })
                    }
                    placeholder="Steps, guidance, or summary"
                  />
                </TextField>
                <TextField>
                  <TextFieldLabel for="library-keywords">
                    Keywords (comma-separated)
                  </TextFieldLabel>
                  <TextFieldInput
                    id="library-keywords"
                    value={form().library.keywords}
                    onInput={(e) =>
                      setForm({
                        ...form(),
                        library: {
                          ...form().library,
                          keywords: e.currentTarget.value,
                        },
                      })
                    }
                    placeholder="audio, noise, cleanup"
                  />
                </TextField>
                <div class="grid gap-2">
                  <label class="text-sm font-medium" for="library-status">
                    Status
                  </label>
                  <select
                    id="library-status"
                    class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form().library.status}
                    onChange={(e) =>
                      setForm({
                        ...form(),
                        library: {
                          ...form().library,
                          status: e.currentTarget.value,
                        },
                      })
                    }
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            </SectionCard>
          </Show>

          <div class="flex gap-2">
            <Button onClick={() => void submit()} disabled={saving()}>
              {saving() ? "Saving…" : "Save answer"}
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={saving()}>
              Reset
            </Button>
          </div>
        </Show>
      </Show>
    </Page>
  );
}
