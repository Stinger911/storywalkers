import { createEffect, createMemo, createSignal, type JSX, Show } from "solid-js";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { TextField, TextFieldInput, TextFieldLabel } from "./text-field";

type DestructiveConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  acknowledgeLabel?: string;
  confirmKeyword?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  children?: JSX.Element;
  onConfirm: () => void | Promise<void>;
  testIdPrefix?: string;
};

export function DestructiveConfirmDialog(props: DestructiveConfirmDialogProps) {
  const [acknowledged, setAcknowledged] = createSignal(false);
  const [confirmValue, setConfirmValue] = createSignal("");

  createEffect(() => {
    if (!props.open) {
      setAcknowledged(false);
      setConfirmValue("");
    }
  });

  const canConfirm = createMemo(() => {
    if (props.loading || props.disabled) return false;
    if (props.acknowledgeLabel && !acknowledged()) return false;
    if (props.confirmKeyword && confirmValue() !== props.confirmKeyword) return false;
    return true;
  });

  const inputLabel = createMemo(() =>
    props.confirmKeyword ? `Type ${props.confirmKeyword}` : "Type to confirm",
  );
  const testId = (suffix: string) =>
    props.testIdPrefix ? `${props.testIdPrefix}-${suffix}` : undefined;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>

        <div class="space-y-3 text-sm">
          <Show when={props.children}>{props.children}</Show>

          <Show when={props.error}>
            <div class="rounded-xl border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {props.error}
            </div>
          </Show>

          <Show when={props.acknowledgeLabel}>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={acknowledged()}
                onChange={(event) => setAcknowledged(event.currentTarget.checked)}
                data-testid={testId("acknowledge")}
              />
              {props.acknowledgeLabel}
            </label>
          </Show>

          <Show when={props.confirmKeyword}>
            <TextField>
              <TextFieldLabel for={testId("confirm-input") || "destructive-confirm-input"}>
                {inputLabel()}
              </TextFieldLabel>
              <TextFieldInput
                id={testId("confirm-input") || "destructive-confirm-input"}
                value={confirmValue()}
                onInput={(event) => setConfirmValue(event.currentTarget.value)}
                placeholder={props.confirmKeyword}
                data-testid={testId("confirm-input")}
              />
            </TextField>
          </Show>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={props.loading}
          >
            {props.cancelLabel || "Cancel"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void props.onConfirm()}
            disabled={!canConfirm()}
            data-testid={testId("confirm-button")}
          >
            {props.confirmLabel || "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
