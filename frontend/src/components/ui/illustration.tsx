import type { Component, ComponentProps } from "solid-js";
import { Show, createSignal } from "solid-js";
import { cn } from "../../lib/utils";

type IllustrationProps = ComponentProps<"img"> & {
  src?: string;
  alt: string;
};

export const Illustration: Component<IllustrationProps> = (props) => {
  const [failed, setFailed] = createSignal(false);
  const showImage = () => Boolean(props.src) && !failed();

  return (
    <div
      class={cn(
        "overflow-hidden rounded-[var(--radius-md)] border border-border/70",
        props.class,
      )}
    >
      <Show
        when={showImage()}
        fallback={
          <div class="h-full w-full bg-gradient-to-br from-[#E7EEF8] via-[#F6EBDD] to-[#DCECF8]" />
        }
      >
        <img
          src={props.src}
          alt={props.alt}
          class="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </Show>
    </div>
  );
};
