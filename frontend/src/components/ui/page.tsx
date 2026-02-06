import type { JSX } from "solid-js";
import { createEffect, onCleanup, Show } from "solid-js";
import { cn } from "../../lib/utils";
import { useAppShellRail } from "../AppShell";

type PageProps = {
  title: string;
  subtitle?: string;
  breadcrumb?: JSX.Element;
  actions?: JSX.Element;
  rightRail?: JSX.Element;
  children: JSX.Element;
  class?: string;
};

export function Page(props: PageProps) {
  const setRail = useAppShellRail();

  createEffect(() => {
    if (!props.rightRail) {
      setRail(null);
      return;
    }
    setRail(props.rightRail);
    onCleanup(() => setRail(null));
  });

  return (
    <section class={cn("space-y-6", props.class)}>
      <header class="space-y-3">
        <Show when={props.breadcrumb}>{props.breadcrumb}</Show>
        <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold">{props.title}</h1>
          <Show when={props.subtitle}>
            <p class="text-sm text-muted-foreground">{props.subtitle}</p>
          </Show>
        </div>
        <Show when={props.actions}>{props.actions}</Show>
        </div>
      </header>
      <div class="space-y-6">{props.children}</div>
    </section>
  );
}
