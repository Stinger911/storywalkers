import type { JSX } from "solid-js";
import { Button } from "../components/ui/button";

type AppShellProps = {
  title: string;
  roleLabel: string;
  onLogout: () => void;
  children: JSX.Element;
};

export function AppShell(props: AppShellProps) {
  return (
    <div class="app-shell">
      <header class="app-shell__header">
        <div class="app-shell__brand">
          <span class="app-shell__mark" />
          <div>
            <div class="app-shell__title">{props.title}</div>
            <div class="app-shell__role">{props.roleLabel}</div>
          </div>
        </div>
        <Button class="btn" onClick={props.onLogout}>
          Logout
        </Button>
      </header>
      <main class="app-shell__content">{props.children}</main>
    </div>
  );
}
