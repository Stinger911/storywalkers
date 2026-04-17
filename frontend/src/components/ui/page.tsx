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
    <section data-page-root class={cn("space-y-8", props.class)}>
      <header data-page-header class="space-y-4">
        <Show when={props.breadcrumb}>{props.breadcrumb}</Show>
        <div class="flex flex-wrap items-end justify-between gap-5">
        <div class="space-y-1.5">
          <h1 class="text-3xl font-extrabold tracking-[-0.04em]">{props.title}</h1>
          <Show when={props.subtitle}>
            <p class="max-w-3xl text-sm text-muted-foreground sm:text-base">{props.subtitle}</p>
          </Show>
        </div>
        <Show when={props.actions}>{props.actions}</Show>
        </div>
      </header>
      <div class="space-y-8">{props.children}</div>
    </section>
  );
}
