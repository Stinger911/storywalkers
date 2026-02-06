import { A } from "@solidjs/router";
import { Card, CardContent, CardTitle } from "../../components/ui/card";
import { Illustration } from "../../components/ui/illustration";
import { RailCard } from "../../components/ui/rail-card";
import { useI18n } from "../../lib/i18n";
import { StudentHome } from "./StudentHome";
import { StudentPlanProvider } from "./studentPlanContext";

export function StudentProfile() {
  const { locale, setLocale, t } = useI18n();
  return (
    <section class="space-y-6">
      <div class="flex items-center justify-end">
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("common.language")}</span>
          <select
            class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            value={locale()}
            onChange={(event) => setLocale(event.currentTarget.value as "en" | "ru")}
            aria-label={t("common.language")}
            title={t("common.language")}
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </label>
      </div>
      <StudentPlanProvider>
        <StudentHome />
      </StudentPlanProvider>
    </section>
  );
}

export function StudentProfileRail() {
  const { t } = useI18n();
  return (
    <>
      <Card class="border border-border/70">
        <CardTitle class="p-3">
          <Illustration
            src="/illustrations/rail-hero.png"
            alt={t("student.profileRail.learningIllustrationAlt")}
            class="h-36 w-full rounded-[var(--radius-lg)] no-border"
          />
        </CardTitle>
        <CardContent class="flex flex-col gap-3 p-3">
          <RailCard title={t("student.profileRail.myQuestions")}>
            <div class="space-y-2 text-sm">
              <A
                href="/student/questions"
                class="flex items-center justify-between text-primary"
              >
                <span>{t("student.profileRail.myQuestions")}</span>
                <span class="text-xs text-muted-foreground">
                  {t("student.profileRail.newLabel")}
                </span>
              </A>
              <A
                href="/student/questions"
                class="flex items-center justify-between text-primary"
              >
                <span>{t("student.profileRail.askQuestion")}</span>
                <span class="text-xs text-muted-foreground">+</span>
              </A>
            </div>
          </RailCard>

          <RailCard title={t("student.profileRail.library")}>
            <div class="space-y-2 text-sm">
              <A
                href="/student/library"
                class="flex items-center justify-between text-primary"
              >
                <span>{t("student.profileRail.library")}</span>
                <span class="text-xs text-muted-foreground">
                  {t("student.profileRail.recent")}
                </span>
              </A>
              <A
                href="/student/library"
                class="flex items-center justify-between text-primary"
              >
                <span>{t("student.profileRail.saved")}</span>
                <span class="text-xs text-muted-foreground">0</span>
              </A>
            </div>
          </RailCard>

          <div class="grid grid-cols-2 gap-3">
            <A
              href="/student/questions"
              class="group rounded-[var(--radius-md)] border border-border/70 bg-card p-2 shadow-rail"
            >
              <Illustration
                src="/illustrations/tile-questions.svg"
                alt={t("student.profileRail.questionsAlt")}
                class="h-20 w-full"
              />
              <div class="mt-2 text-xs font-semibold text-foreground group-hover:text-primary">
                {t("student.profileRail.myQuestions")}
              </div>
            </A>
            <A
              href="/student/library"
              class="group rounded-[var(--radius-md)] border border-border/70 bg-card p-2 shadow-rail"
            >
              <Illustration
                src="/illustrations/tile-library.svg"
                alt={t("student.profileRail.libraryAlt")}
                class="h-20 w-full"
              />
              <div class="mt-2 text-xs font-semibold text-foreground group-hover:text-primary">
                {t("student.profileRail.library")}
              </div>
            </A>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
