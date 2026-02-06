import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";

type SmallStatBadgeProps = {
  children: JSX.Element;
  class?: string;
};

export function SmallStatBadge(props: SmallStatBadgeProps) {
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-semibold text-foreground",
        props.class,
      )}
    >
      {props.children}
    </span>
  );
}
