import { Outlet } from "solid-app-router";
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
        onLogout={() => void auth.logout()}
      >
        {props.children || <Outlet />}
      </AppShell>
    </RequireAuth>
  );
}
