import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { cn } from "../../lib/utils";

type RailCardProps = {
  title: string;
  description?: string;
  actions?: JSX.Element;
  children: JSX.Element;
  class?: string;
};

export function RailCard(props: RailCardProps) {
  return (
    <Card class={cn("border border-border/70 shadow-rail", props.class)}>
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div>
          <CardTitle class="text-base">{props.title}</CardTitle>
          <Show when={props.description}>
            <CardDescription class="text-xs">{props.description}</CardDescription>
          </Show>
        </div>
        <Show when={props.actions}>{props.actions}</Show>
      </CardHeader>
      <CardContent class="px-4 pb-4 pt-0 text-sm">{props.children}</CardContent>
    </Card>
  );
}
