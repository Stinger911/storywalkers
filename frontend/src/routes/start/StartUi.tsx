// Primitives of the pre-registration onboarding theme (see startTheme.css).
import * as SelectPrimitive from "@kobalte/core/select";
import { Show, splitProps, type JSX } from "solid-js";

import { cn } from "../../lib/utils";
import "./startTheme.css";

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "small";
};

export function StartButton(props: ButtonProps) {
  const [local, others] = splitProps(props, ["variant", "class", "type"]);
  return (
    <button
      type={local.type ?? "button"}
      class={cn("st-btn", `st-btn-${local.variant ?? "primary"}`, local.class)}
      {...others}
    />
  );
}

export function StartOption(
  props: Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
    selected: boolean;
  },
) {
  const [local, others] = splitProps(props, ["selected", "class", "type"]);
  return (
    <button
      type={local.type ?? "button"}
      aria-pressed={local.selected}
      class={cn("st-option", local.class)}
      {...others}
    />
  );
}

export function StartInput(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return <input class={cn("st-field", local.class)} {...others} />;
}

export function StartCheckbox(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return <input type="checkbox" class={cn("st-check", local.class)} {...others} />;
}

export function StartError(props: { children: JSX.Element }) {
  return (
    <div
      role="alert"
      class="rounded-md border border-[var(--st-red-border)] bg-[var(--st-red-soft)] px-4 py-3 text-center text-xs text-[var(--st-red)]"
    >
      {props.children}
    </div>
  );
}

export type StartSelectOption = {
  value: string;
  label: string;
  icon?: JSX.Element;
};

type StartSelectProps = {
  options: StartSelectOption[];
  value: string | null;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
};

/** Dropdown with an icon per item. The list is rendered inline (no portal) so the theme CSS applies. */
export function StartSelect(props: StartSelectProps) {
  const selected = () => props.options.find((option) => option.value === props.value) ?? null;

  return (
    <SelectPrimitive.Root<StartSelectOption>
      options={props.options}
      optionValue="value"
      optionTextValue="label"
      value={selected()}
      onChange={(option) => option && props.onChange(option.value)}
      placeholder={props.placeholder}
      placement="bottom"
      gutter={0}
      sameWidth
      itemComponent={(itemProps) => (
        <SelectPrimitive.Item item={itemProps.item} class="st-select-item">
          <Show when={itemProps.item.rawValue.icon}>
            <span class="flex w-6 flex-none justify-center">
              {itemProps.item.rawValue.icon}
            </span>
          </Show>
          <SelectPrimitive.ItemLabel>{itemProps.item.rawValue.label}</SelectPrimitive.ItemLabel>
        </SelectPrimitive.Item>
      )}
    >
      <SelectPrimitive.Trigger class="st-select-trigger" aria-label={props.ariaLabel}>
        <Show when={selected()?.icon}>
          <span class="flex w-6 flex-none justify-center">{selected()?.icon}</span>
        </Show>
        <SelectPrimitive.Value<StartSelectOption> class="flex-1">
          {(state) => state.selectedOption()?.label ?? props.placeholder}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon class="text-[var(--st-muted)]">
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Content class="st-select-list">
        <SelectPrimitive.Listbox />
      </SelectPrimitive.Content>
    </SelectPrimitive.Root>
  );
}

/** Single centered card for screens outside the stepper (sign-in, blocked account). */
export function StartPage(props: { children: JSX.Element }) {
  return (
    <div class="start-theme flex items-center justify-center px-4 py-10 sm:px-6">
      <main class="st-card w-full max-w-[600px] space-y-5 px-7 py-9 sm:px-12">
        {props.children}
      </main>
    </div>
  );
}

export function ButtonRow(props: { children: JSX.Element }) {
  return <div class="flex flex-wrap items-center justify-center gap-4">{props.children}</div>;
}
