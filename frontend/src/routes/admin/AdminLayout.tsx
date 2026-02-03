import { Outlet } from "solid-app-router";
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
        onLogout={() => void auth.logout()}
      >
        {props.children || <Outlet />}
      </AppShell>
    </RequireAuth>
  );
}
