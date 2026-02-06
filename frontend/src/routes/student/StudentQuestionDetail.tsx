import { createEffect, createSignal, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { A } from "@solidjs/router";
import { SectionCard } from "../../components/ui/section-card";
import { getQuestion, type Question } from "../../lib/questionsApi";

export function StudentQuestionDetail() {
  const params = useParams();
  const [question, setQuestion] = createSignal<Question | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!params.id) {
        throw new Error("No question ID provided.");
      }
      const data = await getQuestion(params.id);
      setQuestion(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void load();
  });

  return (
    <section class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-2xl font-semibold">Question detail</h2>
        <A href="/student/questions" class="text-sm text-primary underline">
          Back to questions
        </A>
      </div>

      <Show when={error()}>
        <div class="rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
        <Show when={question()}>
          <SectionCard title={question()?.title ?? "Question"}>
            <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span class="rounded-full border border-border/70 bg-background px-2 py-0.5">
                {question()?.categoryId}
              </span>
              <span class="rounded-full border border-border/70 bg-background px-2 py-0.5">
                {question()?.status === "answered" ? "Answered" : "New"}
              </span>
            </div>
            <p class="mt-3 text-sm text-muted-foreground">
              {question()?.body || "No additional details"}
            </p>
          </SectionCard>

          <SectionCard title="Answer">
            <Show
              when={question()?.answer}
              fallback={
                <div class="text-sm text-muted-foreground">Pending response.</div>
              }
            >
              <p class="text-sm text-muted-foreground">
                {question()?.answer?.text}
              </p>
              <Show when={question()?.answer?.videoUrl}>
                <a
                  class="mt-2 inline-block text-sm text-primary underline"
                  href={question()?.answer?.videoUrl ?? ""}
                  target="_blank"
                  rel="noreferrer"
                >
                  Watch video
                </a>
              </Show>
            </Show>
          </SectionCard>
        </Show>
      </Show>
    </section>
  );
}
