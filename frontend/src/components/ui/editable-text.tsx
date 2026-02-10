import { createEffect, createSignal, Show } from "solid-js";

import { Button } from "./button";
import { TextField, TextFieldInput } from "./text-field";

export type EditableTextProps = {
  value: string;
  canEdit: boolean;
  onSave: (nextValue: string) => Promise<void>;
  onCancel?: () => void;
};

export function EditableText(props: EditableTextProps) {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal(props.value);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    if (!editing()) {
      setDraft(props.value ?? "");
      setError(null);
    }
  });

  const validate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Value is required.";
    if (trimmed.length > 60) return "Must be 60 characters or fewer.";
    return null;
  };

  const startEdit = () => {
    if (!props.canEdit) return;
    setDraft(props.value ?? "");
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(props.value ?? "");
    setError(null);
    props.onCancel?.();
  };

  const saveEdit = async () => {
    if (saving()) return;
    const trimmed = draft().trim();
    const validation = validate(trimmed);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await props.onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <Show
          when={editing()}
          fallback={
            <>
              <span class="text-sm font-medium text-foreground">
                {props.value || "—"}
              </span>
              <Show when={props.canEdit}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startEdit}
                  aria-label="Edit"
                >
                  <span class="material-symbols-outlined text-[18px]">edit</span>
                </Button>
              </Show>
            </>
          }
        >
          <TextField>
            <TextFieldInput
              value={draft()}
              onInput={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              class="h-8"
              disabled={saving()}
            />
          </TextField>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelEdit}
            disabled={saving()}
            aria-label="Cancel"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void saveEdit()}
            disabled={saving()}
            aria-label="Save"
          >
            <span class="material-symbols-outlined text-[18px]">check</span>
          </Button>
        </Show>
      </div>
      <Show when={error()}>
        <div class="text-xs text-error-foreground">{error()}</div>
      </Show>
    </div>
  );
}
