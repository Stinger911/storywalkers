import { splitProps, type ComponentProps } from "solid-js";

import { cn } from "../../lib/utils";

type ProgressBarProps = ComponentProps<"div"> & {
  value: number;
};

export function ProgressBar(props: ProgressBarProps) {
  const [local, rest] = splitProps(props, ["class", "value"]);
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(local.value) ? local.value : 0));

  return (
    <div
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
      class={cn("h-2 w-full overflow-hidden rounded-full bg-muted", local.class)}
      {...rest}
    >
      <div
        class="h-full rounded-full bg-primary transition-all"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
