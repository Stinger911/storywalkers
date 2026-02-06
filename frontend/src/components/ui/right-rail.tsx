import type { JSX } from "solid-js";
import { cn } from "../../lib/utils";

type RightRailProps = {
  children: JSX.Element;
  class?: string;
};

export function RightRail(props: RightRailProps) {
  return <div class={cn("space-y-4", props.class)}>{props.children}</div>;
}
