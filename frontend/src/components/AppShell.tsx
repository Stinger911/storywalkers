import type { JSX } from "solid-js";
import { createContext, createSignal, Show, useContext } from "solid-js";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

type AppShellProps = {
  title: string;
  roleLabel: string;
  userName?: string;
  centerSlot?: JSX.Element;
  userMenuSlot?: JSX.Element;
  rightRail?: JSX.Element;
  onLogout: () => void;
  children: JSX.Element;
};

type AppShellRailSetter = (rail: JSX.Element | null) => void;

const AppShellRailContext = createContext<AppShellRailSetter>();

export function useAppShellRail() {
  const ctx = useContext(AppShellRailContext);
  if (!ctx) {
    throw new Error("useAppShellRail must be used within AppShell");
  }
  return ctx;
}

export function AppShell(props: AppShellProps) {
  const [railContent, setRailContent] = createSignal<JSX.Element | null>(null);
  const activeRail = () => props.rightRail ?? railContent();
  const hasRail = () => Boolean(activeRail());
  return (
    <div class="min-h-screen bg-background text-foreground">
      <header class="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div class="flex min-w-0 items-center gap-3">
            <Avatar class="h-9 w-9 bg-primary text-primary-foreground">
              <AvatarFallback class="bg-primary text-primary-foreground">
                SW
              </AvatarFallback>
            </Avatar>
            <div class="min-w-0">
              <div class="truncate text-lg font-semibold">{props.title}</div>
              <div class="text-xs text-muted-foreground">
                {props.roleLabel}
                <Show when={props.userName}>
                  <span> · {props.userName}</span>
                </Show>
              </div>
            </div>
          </div>
          <Show when={props.centerSlot}>
            <div class="flex flex-1 items-center justify-center gap-2">
              {props.centerSlot}
            </div>
          </Show>
          <div class="flex items-center gap-3">
            <Show when={props.userMenuSlot}>{props.userMenuSlot}</Show>
            <Button variant="outline" onClick={props.onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <AppShellRailContext.Provider value={setRailContent}>
        <main class="mx-auto w-full max-w-6xl px-6 py-8">
          <div
            class={`grid gap-6 ${
              hasRail() ? "lg:grid-cols-[minmax(0,1fr)_280px]" : "grid-cols-1"
            }`}
          >
            <div class={hasRail() ? "min-w-0" : ""}>{props.children}</div>
            <Show when={activeRail()}>
              <aside class="space-y-4">{activeRail()}</aside>
            </Show>
          </div>
        </main>
      </AppShellRailContext.Provider>
    </div>
  );
}
