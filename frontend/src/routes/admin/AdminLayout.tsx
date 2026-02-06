import { AppShell } from "../../components/AppShell";
import { useAuth } from "../../lib/auth";
import { RequireAuth } from "../RequireAuth";
import type { JSX } from "solid-js";

type AdminLayoutProps = {
  children?: JSX.Element;
};

export function AdminLayout(props: AdminLayoutProps) {
  const auth = useAuth();

  return (
    <RequireAuth role="staff">
      <AppShell
        title="Admin Console"
        roleLabel="Staff"
        userName={auth.me()?.displayName}
        centerSlot={
          <div class="flex items-center gap-2 text-muted-foreground">
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
        onLogout={() => {
          void auth.logout();
          window.location.href = "/";
        }}
      >
        {props.children}
      </AppShell>
    </RequireAuth>
  );
}
