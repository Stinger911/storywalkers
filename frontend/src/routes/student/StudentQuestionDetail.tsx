import { createEffect, createSignal, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { A } from "@solidjs/router";
import { SectionCard } from "../../components/ui/section-card";
import { getQuestion, type Question } from "../../lib/questionsApi";
import { useI18n } from "../../lib/i18n";

export function StudentQuestionDetail() {
  const params = useParams();
  const { t } = useI18n();
  const [question, setQuestion] = createSignal<Question | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!params.id) {
        throw new Error(t("student.questionDetail.noIdError"));
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
        <h2 class="text-2xl font-semibold">{t("student.questionDetail.title")}</h2>
        <A href="/student/questions" class="text-sm text-primary underline">
          {t("student.questionDetail.back")}
        </A>
      </div>

      <Show when={error()}>
        <div class="rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-sm">{t("common.loading")}</div>}>
        <Show when={question()}>
          <SectionCard title={question()?.title ?? t("common.question")}>
            <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span class="rounded-full border border-border/70 bg-background px-2 py-0.5">
                {question()?.categoryId}
              </span>
              <span class="rounded-full border border-border/70 bg-background px-2 py-0.5">
                {question()?.status === "answered"
                  ? t("common.status.answered")
                  : t("common.status.new")}
              </span>
            </div>
            <p class="mt-3 text-sm text-muted-foreground">
              {question()?.body || t("student.questionDetail.noDetails")}
            </p>
          </SectionCard>

          <SectionCard title={t("common.answer")}>
            <Show
              when={question()?.answer}
              fallback={
                <div class="text-sm text-muted-foreground">
                  {t("student.questionDetail.pending")}
                </div>
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
                  {t("student.questionDetail.watchVideo")}
                </a>
              </Show>
            </Show>
          </SectionCard>
        </Show>
      </Show>
    </section>
  );
}
