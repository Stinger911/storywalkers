import { createEffect, createSignal, Show } from "solid-js";
import { useParams, A } from "@solidjs/router";
// import { Button } from "../../components/ui/button";
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
      <div class="rounded-2xl border bg-card p-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-semibold">Question detail</h2>
          <A href="/student/profile" class="text-sm text-primary underline">
            Back to profile
          </A>
        </div>
      </div>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
        <Show when={question()}>
          <div class="rounded-2xl border bg-card p-6">
            <div class="text-xs text-muted-foreground">
              {question()?.categoryId}
            </div>
            <h3 class="text-xl font-semibold">{question()?.title}</h3>
            <p class="mt-2 text-sm text-muted-foreground">
              {question()?.body || "No additional details"}
            </p>
            <div class="mt-4 text-sm">
              Status: {question()?.status === "answered" ? "Answered" : "New"}
            </div>
          </div>

          <div class="rounded-2xl border bg-card p-6">
            <h4 class="text-lg font-semibold">Answer</h4>
            <Show
              when={question()?.answer}
              fallback={
                <div class="text-sm text-muted-foreground">No answer yet.</div>
              }
            >
              <p class="mt-2 text-sm text-muted-foreground">
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
          </div>
        </Show>
      </Show>
    </section>
  );
}
