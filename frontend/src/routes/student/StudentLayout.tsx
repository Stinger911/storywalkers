import { AppShell } from "../../components/AppShell";
import { useAuth } from "../../lib/auth";
import { RequireAuth } from "../RequireAuth";
import type { JSX } from "solid-js";

type StudentLayoutProps = {
  children?: JSX.Element;
  rightRail?: JSX.Element;
};

const tabs = [
  { id: "profile", label: "Profile", icon: "dashboard" },
  { id: "questions", label: "My Questions", icon: "question_answer" },
  { id: "library", label: "Library", icon: "library_books" },
] as const;

export function StudentLayout(props: StudentLayoutProps) {
  const auth = useAuth();

  const shell = (
    <AppShell
      title="Student Dashboard"
      roleLabel="Student"
      userName={auth.me()?.displayName}
      centerSlot={
        <div class="flex items-center gap-3 text-muted-foreground">
          {tabs.map((tab) => (
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
            <span class="hidden sm:inline">Report a bug</span>
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
