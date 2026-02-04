import { AppShell } from "../../components/AppShell";
import { useAuth } from "../../lib/auth";
import { RequireAuth } from "../RequireAuth";
import type { JSX } from "solid-js";

type StudentLayoutProps = {
  children?: JSX.Element;
};

export function StudentLayout(props: StudentLayoutProps) {
  const auth = useAuth();

  return (
    <RequireAuth role="student">
      <AppShell
        title="Student Dashboard"
        roleLabel="Student"
        userName={auth.me()?.displayName}
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
