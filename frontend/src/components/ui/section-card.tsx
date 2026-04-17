import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { cn } from "../../lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  actions?: JSX.Element;
  children: JSX.Element;
  class?: string;
};

export function SectionCard(props: SectionCardProps) {
  return (
    <Card
      data-section-card
      class={cn(
        "border border-border/70 rounded-[calc(var(--radius-lg)+4px)] shadow-none",
        props.class,
      )}
    >
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 px-6 py-6">
        <div>
          <CardTitle class="text-xl tracking-[-0.03em]">{props.title}</CardTitle>
          <Show when={props.description}>
            <CardDescription class="mt-1 max-w-2xl text-sm leading-6">
              {props.description}
            </CardDescription>
          </Show>
        </div>
        <Show when={props.actions}>{props.actions}</Show>
      </CardHeader>
      <CardContent class="px-6 pb-6 pt-0">{props.children}</CardContent>
    </Card>
  );
}
