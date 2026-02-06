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
    <Card class={cn("border border-border/70", props.class)}>
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div>
          <CardTitle class="text-lg">{props.title}</CardTitle>
          <Show when={props.description}>
            <CardDescription>{props.description}</CardDescription>
          </Show>
        </div>
        <Show when={props.actions}>{props.actions}</Show>
      </CardHeader>
      <CardContent class="px-6 pb-6 pt-0">{props.children}</CardContent>
    </Card>
  );
}
