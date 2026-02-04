import type { JSX } from "solid-js";
import { Button } from "../components/ui/button";
import { Grid, Col } from "../components/ui/grid";

type AppShellProps = {
  title: string;
  roleLabel: string;
  userName?: string;
  onLogout: () => void;
  children: JSX.Element;
};

export function AppShell(props: AppShellProps) {
  return (
    <div class="app-shell">
      <header class="app-shell__header">
        <div class="app-shell__brand">
          <span class="app-shell__mark" />
          <Grid cols={3} class="w-full gap-4">
            <Col class="app-shell__title">{props.title}</Col>
            <Col class="app-shell__role flex justify-center ">
              {props.roleLabel === "Staff" ? (
                <span class="icon-admin" title="Admin" />
              ) : props.roleLabel === "Student" ? (
                <span class="icon-user" title="User" />
              ) : null}
              {props.roleLabel} {props.userName}
            </Col>
            <Col class="app-shell__actions flex justify-end">
              <Button class="btn" onClick={props.onLogout}>
                Logout
              </Button>
            </Col>
          </Grid>
        </div>
      </header>
      <main class="app-shell__content">{props.children}</main>
    </div>
  );
}
