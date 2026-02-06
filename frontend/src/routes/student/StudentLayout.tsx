import { AppShell } from "../../components/AppShell";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { RequireAuth } from "../RequireAuth";
import { createMemo, type JSX } from "solid-js";

type StudentLayoutProps = {
  children?: JSX.Element;
  rightRail?: JSX.Element;
};

export function StudentLayout(props: StudentLayoutProps) {
  const auth = useAuth();
  const { t } = useI18n();

  const tabs = createMemo(
    () =>
      [
        {
          id: "profile",
          label: t("student.layout.tabs.profile"),
          icon: "dashboard",
        },
        {
          id: "questions",
          label: t("student.layout.tabs.questions"),
          icon: "question_answer",
        },
        {
          id: "library",
          label: t("student.layout.tabs.library"),
          icon: "library_books",
        },
      ] as const,
  );

  const shell = (
    <AppShell
      title={t("student.layout.title")}
      roleLabel={t("student.layout.roleLabel")}
      userName={auth.me()?.displayName}
      centerSlot={
        <div class="flex items-center gap-3 text-muted-foreground">
          {tabs().map((tab) => (
            <a
              href={`/student/${tab.id === "profile" ? "" : tab.id}`}
              class="flex items-center gap-1 text-sm hover:text-primary"
            >
              <span class="material-symbols-outlined text-[20px]">
                {tab.icon}
              </span>
              <span class="hidden sm:inline">{tab.label}</span>
            </a>
          ))}
          <a
            href="https://github.com/Stinger911/storywalkers/issues/new"
            target="blank"
            class="flex items-center gap-1 text-sm hover:text-primary"
          >
            <span class="material-symbols-outlined text-[20px]">
              bug_report
            </span>
            <span class="hidden sm:inline">{t("student.layout.reportBug")}</span>
          </a>
        </div>
      }
      rightRail={props.rightRail}
      onLogout={() => {
        void auth.logout();
        window.location.href = "/";
      }}
    >
      {props.children}
    </AppShell>
  );

  return <RequireAuth role="student">{shell}</RequireAuth>;
}
