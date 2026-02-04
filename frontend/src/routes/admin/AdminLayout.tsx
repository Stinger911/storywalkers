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
