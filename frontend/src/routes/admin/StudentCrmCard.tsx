import { For, Show, createEffect, createSignal } from "solid-js";

import { Button } from "../../components/ui/button";
import { Icon } from "../../components/ui/icon";
import { SectionCard } from "../../components/ui/section-card";
import { showToast } from "../../components/ui/toast";
import { useAuth } from "../../lib/auth";
import {
  addCrmNote,
  createCrmContact,
  deleteCrmNote,
  getCrmContactByUser,
  listCrmStatuses,
  updateCrmContact,
  type CrmContact,
  type CrmContactStatus,
  type CrmNote,
  type CrmStatusOption,
} from "../../lib/adminApi";
import { formatDate } from "../../lib/utils";

type StudentCrmCardProps = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
};

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const selectClass =
  "admin-select h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function errorMessage(err: unknown, fallback: string) {
  return (err as Error)?.message || fallback;
}

/**
 * The same pipeline fields as /admin/crm, next to the account they belong to.
 * Admin-only, like the CRM section itself.
 */
export function StudentCrmCard(props: StudentCrmCardProps) {
  const auth = useAuth();
  const isAdmin = () => auth.me()?.roleRaw === "admin";

  const [statuses, setStatuses] = createSignal<CrmStatusOption[]>([]);
  const [contact, setContact] = createSignal<CrmContact | null>(null);
  const [linked, setLinked] = createSignal(true);
  const [notes, setNotes] = createSignal<CrmNote[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [noteDraft, setNoteDraft] = createSignal("");

  createEffect(() => {
    if (!isAdmin() || !props.uid) {
      setLoading(false);
      return;
    }
    const uid = props.uid;
    setLoading(true);
    setError(null);
    void getCrmContactByUser(uid)
      .then((data) => {
        setContact(data.contact);
        setNotes(data.notes);
        setLinked(data.linked);
      })
      .catch((err) => setError(errorMessage(err, "Could not load the CRM card.")))
      .finally(() => setLoading(false));
    void listCrmStatuses()
      .then((data) => setStatuses(data.items))
      .catch(() => {
        // Labels are a nicety; the card still works with raw codes.
      });
  });

  const patch = async (
    payload: Parameters<typeof updateCrmContact>[1],
    title: string,
  ) => {
    const current = contact();
    if (!current || saving()) return;
    setSaving(true);
    try {
      const updated = await updateCrmContact(current.id, payload);
      setContact({ ...current, ...updated });
      showToast({ variant: "success", title });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Save failed",
        description: errorMessage(err, "Could not update the contact."),
      });
    } finally {
      setSaving(false);
    }
  };

  const createContact = async () => {
    if (saving()) return;
    setSaving(true);
    try {
      const created = await createCrmContact({
        userUid: props.uid,
        email: props.email || null,
        name: props.displayName || null,
      });
      setContact(created);
      setLinked(true);
      setNotes([]);
      showToast({ variant: "success", title: "Contact created" });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Create failed",
        description: errorMessage(err, "Could not create the contact."),
      });
    } finally {
      setSaving(false);
    }
  };

  const linkToAccount = async () => {
    await patch({ userUid: props.uid }, "Contact linked");
    setLinked(true);
  };

  const submitNote = async () => {
    const current = contact();
    const text = noteDraft().trim();
    if (!current || !text || saving()) return;
    setSaving(true);
    try {
      const note = await addCrmNote(current.id, text);
      setNotes((prev) => [note, ...prev]);
      setNoteDraft("");
      setContact({ ...current, lastNoteText: note.text });
      showToast({ variant: "success", title: "Note added" });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Save failed",
        description: errorMessage(err, "Could not add the note."),
      });
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (note: CrmNote) => {
    const current = contact();
    if (!current) return;
    try {
      await deleteCrmNote(current.id, note.id);
      setNotes((prev) => prev.filter((row) => row.id !== note.id));
      showToast({ variant: "success", title: "Note deleted" });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Delete failed",
        description: errorMessage(err, "Could not delete the note."),
      });
    }
  };

  return (
    <Show when={isAdmin()}>
      <SectionCard
        title="CRM"
        description="Sales status, next ping and the feedback log."
        actions={
          <a
            href="/admin/crm"
            class="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            <span>Open CRM</span>
            <Icon name="open_in_new" class="text-[14px]" />
          </a>
        }
      >
        <Show when={error()}>
          <div class="mb-3 rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
            {error()}
          </div>
        </Show>
        <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
          <Show
            when={contact()}
            fallback={
              <div class="flex flex-wrap items-center gap-3 text-sm">
                <span class="text-muted-foreground">
                  This account is not in the pipeline yet.
                </span>
                <Button size="sm" onClick={() => void createContact()} disabled={saving()}>
                  Add to CRM
                </Button>
              </div>
            }
          >
            {(current) => (
              <div class="grid gap-4">
                <Show when={!linked()}>
                  <div class="flex flex-wrap items-center gap-3 rounded-md border border-warning-foreground bg-warning px-3 py-2 text-sm text-warning-foreground">
                    <span>
                      Matched by email only — this contact is not tied to the account.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void linkToAccount()}
                      disabled={saving()}
                    >
                      Link to this account
                    </Button>
                  </div>
                </Show>
                <div class="grid gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-sm font-medium">
                    Status
                    <select
                      class={selectClass}
                      value={current().status ?? ""}
                      disabled={saving()}
                      onChange={(event) =>
                        void patch(
                          {
                            status: (event.currentTarget.value ||
                              null) as CrmContactStatus | null,
                          },
                          "Status updated",
                        )
                      }
                    >
                      <option value="">No status</option>
                      <For each={statuses()}>
                        {(option) => <option value={option.value}>{option.label}</option>}
                      </For>
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-sm font-medium">
                    Next ping
                    <input
                      class={inputClass}
                      type="date"
                      value={current().nextPingAt ?? ""}
                      disabled={saving()}
                      onChange={(event) =>
                        void patch(
                          { nextPingAt: event.currentTarget.value || null },
                          "Ping updated",
                        )
                      }
                    />
                  </label>
                </div>
                <Show when={current().statusRaw}>
                  <div class="text-xs text-muted-foreground">
                    From the spreadsheet: {current().statusRaw}
                  </div>
                </Show>
                <div class="grid gap-2">
                  <div class="text-sm font-semibold">Feedback log</div>
                  <div class="flex gap-2">
                    <textarea
                      class="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Add a note"
                      aria-label="New CRM note"
                      value={noteDraft()}
                      onInput={(event) => setNoteDraft(event.currentTarget.value)}
                    />
                    <Button
                      size="sm"
                      onClick={() => void submitNote()}
                      disabled={saving() || !noteDraft().trim()}
                    >
                      Add
                    </Button>
                  </div>
                  <Show
                    when={notes().length > 0}
                    fallback={
                      <div class="text-sm text-muted-foreground">No notes yet.</div>
                    }
                  >
                    <ul class="space-y-2">
                      <For each={notes()}>
                        {(note) => (
                          <li class="rounded-md border border-border/70 px-3 py-2">
                            <div class="flex items-start justify-between gap-2">
                              <div class="whitespace-pre-wrap text-sm">{note.text}</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Delete CRM note ${note.id}`}
                                title="Delete note"
                                onClick={() => void removeNote(note)}
                              >
                                <Icon name="delete" class="text-[16px]" />
                              </Button>
                            </div>
                            <div class="text-xs text-muted-foreground">
                              {note.authorName}
                              <Show when={note.createdAt}>
                                {" · "}
                                {formatDate(note.createdAt as string)}
                              </Show>
                              <Show when={note.imported}>{" · imported"}</Show>
                            </div>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              </div>
            )}
          </Show>
        </Show>
      </SectionCard>
    </Show>
  );
}
