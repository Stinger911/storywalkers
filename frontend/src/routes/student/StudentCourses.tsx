import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useAuth } from "../../lib/auth";
import { createCheckoutIntent, type CheckoutIntentResponse } from "../../lib/checkoutApi";
import {
  convertUsdCentsToCurrencyCents,
  formatCents,
  listCourses,
  type Course,
} from "../../lib/coursesApi";
import { getFxRates } from "../../lib/fxApi";
import { useI18n } from "../../lib/i18n";

export function StudentCourses() {
  const auth = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [courses, setCourses] = createSignal<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = createSignal<string[]>([]);
  const [fxRates, setFxRates] = createSignal<Record<string, number>>({ USD: 1 });
  const [checkout, setCheckout] = createSignal<CheckoutIntentResponse | null>(null);
  const isFirstHundred = createMemo(() => auth.me()?.isFirstHundred === true);

  const ownedCourseIds = createMemo(
    () => new Set(auth.me()?.selectedCourses?.filter((value) => typeof value === "string") ?? []),
  );
  const preferredCurrency = createMemo(() => auth.me()?.preferredCurrency || "USD");
  const currencyRate = createMemo(() => {
    const rate = fxRates()[preferredCurrency()];
    return typeof rate === "number" && rate > 0 ? rate : 1;
  });
  const availableCourses = createMemo(() =>
    courses().filter((course) => course.isActive && !ownedCourseIds().has(course.id)),
  );
  const ownedCourses = createMemo(() =>
    courses().filter((course) => course.isActive && ownedCourseIds().has(course.id)),
  );
  const selectedCourses = createMemo(() => {
    const selected = new Set(selectedCourseIds());
    return availableCourses().filter((course) => selected.has(course.id));
  });
  const totalPrice = createMemo(() =>
    isFirstHundred()
      ? 0
      : selectedCourses().reduce(
          (sum, course) =>
            sum + convertUsdCentsToCurrencyCents(course.priceUsdCents, currencyRate()),
          0,
          0,
        ),
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesData, fxData] = await Promise.all([listCourses({ force: true }), getFxRates()]);
      setCourses(coursesData.items);
      setFxRates(fxData.rates || { USD: 1 });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void load();
  });

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((current) =>
      current.includes(courseId)
        ? current.filter((value) => value !== courseId)
        : [...current, courseId],
    );
    setCheckout(null);
  };

  const startCheckout = async () => {
    if (selectedCourseIds().length === 0) {
      setError(t("student.courses.selectAtLeastOne"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createCheckoutIntent({
        selectedCourses: selectedCourseIds(),
      });
      setCheckout(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (usdCents: number) =>
    formatCents(
      convertUsdCentsToCurrencyCents(usdCents, currencyRate()),
      preferredCurrency(),
    );

  const FreePrice = (props: { usdCents: number }) => (
    <div class="text-sm font-medium">
      <span class="text-muted-foreground line-through">{formatPrice(props.usdCents)}</span>
      <span class="ml-2">{formatCents(0, preferredCurrency())}</span>
    </div>
  );

  return (
    <section class="space-y-6">
      <SectionCard
        title={t("student.courses.title")}
        description={t("student.courses.description")}
      >
        <Show when={!loading()} fallback={<div class="text-sm text-muted-foreground">{t("student.courses.loading")}</div>}>
          <Show when={!error()} fallback={<div class="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error-foreground">{error()}</div>}>
            <div class="space-y-4">
              <Show
                when={availableCourses().length > 0}
                fallback={<div class="text-sm text-muted-foreground">{t("student.courses.emptyAvailable")}</div>}
              >
                <div class="grid gap-3 md:grid-cols-2">
                  <For each={availableCourses()}>
                    {(course) => (
                      <label class="student-list-card rounded-[calc(var(--radius-lg)+2px)] border border-border/70 bg-card p-4 shadow-none">
                        <div class="flex items-start justify-between gap-3">
                          <div class="space-y-1">
                            <div class="text-sm font-semibold">{course.title}</div>
                            <div class="text-xs text-muted-foreground">{course.shortDescription}</div>
                            <Show
                              when={isFirstHundred()}
                              fallback={<div class="text-sm font-medium">{formatPrice(course.priceUsdCents)}</div>}
                            >
                              <FreePrice usdCents={course.priceUsdCents} />
                            </Show>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedCourseIds().includes(course.id)}
                            onChange={() => toggleCourse(course.id)}
                          />
                        </div>
                      </label>
                    )}
                  </For>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                  <div class="text-sm text-muted-foreground">
                    {t("student.courses.selectedCount", { count: selectedCourseIds().length })}
                  </div>
                  <div class="text-lg font-semibold">
                    {formatCents(totalPrice(), preferredCurrency())}
                  </div>
                </div>
                <Show when={isFirstHundred()}>
                  <div class="text-sm text-muted-foreground">
                    {t("student.courses.freeAccessHint")}
                  </div>
                </Show>

                <Button onClick={() => void startCheckout()} disabled={saving() || selectedCourseIds().length === 0}>
                  {t("student.courses.createPaymentInstructions")}
                </Button>
              </Show>
            </div>
          </Show>
        </Show>
      </SectionCard>

      <Show when={ownedCourses().length > 0}>
        <SectionCard title={t("student.courses.ownedTitle")}>
          <div class="flex flex-wrap gap-2">
            <For each={ownedCourses()}>
              {(course) => (
                <span class="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium">
                  {course.title}
                </span>
              )}
            </For>
          </div>
        </SectionCard>
      </Show>

      <Show when={checkout()}>
        {(result) => (
          <SectionCard title={t("student.courses.paymentInstructionsTitle")}>
            <div class="space-y-3 text-sm">
              <div class="rounded-xl border border-border/70 bg-card p-4">
                <div class="text-xs font-semibold uppercase text-muted-foreground">{t("student.courses.activationCode")}</div>
                <div class="mt-2 font-mono text-lg">{result().activationCode}</div>
              </div>
              <div class="text-muted-foreground">{result().instructionsText}</div>
              <div class="text-muted-foreground">
                {t("student.courses.amount", {
                  amount: formatCents(result().amount, result().currency),
                })}
              </div>
              <div class="flex flex-wrap gap-2">
                <Show when={result().amount > 0}>
                  <Button as="a" href={result().redirectUrl} target="_blank" rel="noopener noreferrer">
                    {t("student.courses.openPaymentPage")}
                  </Button>
                </Show>
                <Button variant="outline" onClick={() => void load()}>
                  {t("student.courses.refreshCourses")}
                </Button>
              </div>
            </div>
          </SectionCard>
        )}
      </Show>
    </section>
  );
}
