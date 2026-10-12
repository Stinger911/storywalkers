import { createSignal, createEffect, For, Index, Show, onMount } from "solid-js";

import { Button } from "../../components/ui/button";
import { Icon } from "../../components/ui/icon";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { showToast } from "../../components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { useAuth } from "../../lib/auth";
import {
  addCrmNote,
  createCrmContact,
  deleteCrmNote,
  getCrmContact,
  listCrmContacts,
  listCrmStatuses,
  updateCrmContact,
  type CrmContact,
  type CrmContactStatus,
  type CrmContactWrite,
  type CrmNote,
  type CrmPingFilter,
  type CrmStatusOption,
} from "../../lib/adminApi";
import { formatDate } from "../../lib/utils";

const PAGE_SIZE = 50;

const PING_FILTERS: { value: CrmPingFilter; label: string }[] = [
  { value: "today", label: "Ping today" },
  { value: "overdue", label: "Overdue" },
  { value: "due", label: "Today or overdue" },
  { value: "none", label: "No ping set" },
];

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const selectClass =
  "admin-select h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** Local calendar day, matching how an admin reads the ping column. */
function todayIso() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function emptyDraft(): CrmContactWrite {
  return {
    name: "",
    email: "",
    telegram: "",
    channelUrl: "",
    status: null,
    nextPingAt: "",
  };
}

function errorMessage(err: unknown, fallback: string) {
  return (err as Error)?.message || fallback;
}

export function AdminCrm() {
  const auth = useAuth();
  const isAdmin = () => auth.me()?.roleRaw === "admin";

  const [statuses, setStatuses] = createSignal<CrmStatusOption[]>([]);
  const [items, setItems] = createSignal<CrmContact[]>([]);
  const [total, setTotal] = createSignal(0);
  const [nextCursor, setNextCursor] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [statusFilter, setStatusFilter] = createSignal<string>("");
  const [pingFilter, setPingFilter] = createSignal<string>("");
  const [searchDraft, setSearchDraft] = createSignal("");
  const [search, setSearch] = createSignal("");

  const [savingId, setSavingId] = createSignal<string | null>(null);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [notes, setNotes] = createSignal<CrmNote[]>([]);
  const [notesLoading, setNotesLoading] = createSignal(false);
  const [noteDraft, setNoteDraft] = createSignal("");
  const [savingNote, setSavingNote] = createSignal(false);
  const [fieldsDraft, setFieldsDraft] = createSignal<CrmContactWrite>(emptyDraft());

  const [createOpen, setCreateOpen] = createSignal(false);
  const [createDraft, setCreateDraft] = createSignal<CrmContactWrite>(emptyDraft());
  const [creating, setCreating] = createSignal(false);

  const statusLabel = (status?: CrmContactStatus | null) =>
    statuses().find((option) => option.value === status)?.label ?? "";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCrmContacts({
        status: (statusFilter() || undefined) as CrmContactStatus | "none" | undefined,
        ping: (pingFilter() || undefined) as CrmPingFilter | undefined,
        q: search() || undefined,
        limit: PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total ?? data.items.length);
      setNextCursor(data.nextCursor ?? null);
      setExpandedId(null);
    } catch (err) {
      setError(errorMessage(err, "Could not load contacts."));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const cursor = nextCursor();
    if (!cursor || loadingMore()) return;
    setLoadingMore(true);
    try {
      const data = await listCrmContacts({
        status: (statusFilter() || undefined) as CrmContactStatus | "none" | undefined,
        ping: (pingFilter() || undefined) as CrmPingFilter | undefined,
        q: search() || undefined,
        limit: PAGE_SIZE,
        cursor,
      });
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      showToast({
        variant: "error",
        title: "Load failed",
        description: errorMessage(err, "Could not load more contacts."),
      });
    } finally {
      setLoadingMore(false);
    }
  };

  onMount(() => {
    if (!isAdmin()) return;
    void listCrmStatuses()
      .then((data) => setStatuses(data.items))
      .catch(() => {
        // The list still works without labels; statuses fall back to raw codes.
      });
  });

  createEffect(() => {
    if (!isAdmin()) {
      setLoading(false);
      return;
    }
    statusFilter();
    pingFilter();
    search();
    void load();
  });

  const applyPatch = async (
    contact: CrmContact,
    patch: CrmContactWrite,
    successTitle: string,
  ) => {
    if (savingId()) return false;
    setSavingId(contact.id);
    try {
      const updated = await updateCrmContact(contact.id, patch);
      setItems((prev) =>
        prev.map((row) => (row.id === contact.id ? { ...row, ...updated } : row)),
      );
      showToast({ variant: "success", title: successTitle });
      return true;
    } catch (err) {
      showToast({
        variant: "error",
        title: "Save failed",
        description: errorMessage(err, "Could not update the contact."),
      });
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const openNotes = async (contact: CrmContact) => {
    if (expandedId() === contact.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(contact.id);
    setNotes([]);
    setNoteDraft("");
    setFieldsDraft({
      name: contact.name ?? "",
      email: contact.email ?? "",
      telegram: contact.telegram ?? "",
      channelUrl: contact.channelUrl ?? "",
    });
    setNotesLoading(true);
    try {
      const data = await getCrmContact(contact.id);
      setNotes(data.notes);
    } catch (err) {
      showToast({
        variant: "error",
        title: "Load failed",
        description: errorMessage(err, "Could not load the feedback log."),
      });
    } finally {
      setNotesLoading(false);
    }
  };

  const saveFields = async (contact: CrmContact) => {
    const draft = fieldsDraft();
    const patch: CrmContactWrite = {
      name: draft.name?.trim() || null,
      email: draft.email?.trim() || null,
      telegram: draft.telegram?.trim() || null,
      channelUrl: draft.channelUrl?.trim() || null,
    };
    await applyPatch(contact, patch, "Contact updated");
  };

  const submitNote = async (contact: CrmContact) => {
    const text = noteDraft().trim();
    if (!text || savingNote()) return;
    setSavingNote(true);
    try {
      const note = await addCrmNote(contact.id, text);
      setNotes((prev) => [note, ...prev]);
      setNoteDraft("");
      setItems((prev) =>
        prev.map((row) =>
          row.id === contact.id
            ? {
                ...row,
                lastNoteText: note.text,
                lastNoteAt: (note.createdAt as string | null) ?? row.lastNoteAt,
              }
            : row,
        ),
      );
      showToast({ variant: "success", title: "Note added" });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Save failed",
        description: errorMessage(err, "Could not add the note."),
      });
    } finally {
      setSavingNote(false);
    }
  };

  const removeNote = async (contact: CrmContact, note: CrmNote) => {
    try {
      await deleteCrmNote(contact.id, note.id);
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

  const canCreate = () => {
    const draft = createDraft();
    return Boolean(
      draft.name?.trim() || draft.email?.trim() || draft.telegram?.trim(),
    );
  };

  const submitCreate = async () => {
    if (!canCreate() || creating()) return;
    const draft = createDraft();
    setCreating(true);
    try {
      const created = await createCrmContact({
        name: draft.name?.trim() || null,
        email: draft.email?.trim() || null,
        telegram: draft.telegram?.trim() || null,
        channelUrl: draft.channelUrl?.trim() || null,
        status: draft.status || null,
        nextPingAt: draft.nextPingAt || null,
      });
      setItems((prev) => [created, ...prev]);
      setTotal((prev) => prev + 1);
      setCreateOpen(false);
      setCreateDraft(emptyDraft());
      showToast({ variant: "success", title: "Lead added" });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Create failed",
        description: errorMessage(err, "Could not create the lead."),
      });
    } finally {
      setCreating(false);
    }
  };

  const pingClass = (value?: string | null) => {
    if (!value) return "text-muted-foreground";
    const today = todayIso();
    if (value < today) return "text-error-foreground font-semibold";
    if (value === today) return "text-warning-foreground font-semibold";
    return "";
  };

  return (
    <Page
      title="CRM"
      subtitle="Sales pipeline: status, feedback log and the next ping."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>CRM</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <Show when={isAdmin()}>
          <div class="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading()}
            >
              Refresh
            </Button>
            <Button onClick={() => setCreateOpen(true)}>Add lead</Button>
          </div>
        </Show>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class="rounded-2xl border border-border/70 p-6 text-sm text-muted-foreground">
            The CRM holds personal data of leads and is limited to admins.
          </div>
        }
      >
        <Show when={error()}>
          <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
            {error()}
          </div>
        </Show>

        <SectionCard
          title="Contacts"
          description={`${total()} contact${total() === 1 ? "" : "s"} matching the filters.`}
        >
          <form
            class="mb-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchDraft().trim());
            }}
          >
            <div class="flex w-[200px] flex-col gap-2">
              <label class="text-sm font-medium" for="crm-status-filter">
                Status
              </label>
              <select
                id="crm-status-filter"
                class={selectClass}
                value={statusFilter()}
                onChange={(event) => setStatusFilter(event.currentTarget.value)}
              >
                <option value="">All statuses</option>
                <option value="none">No status (new)</option>
                <For each={statuses()}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </select>
            </div>
            <div class="flex w-[200px] flex-col gap-2">
              <label class="text-sm font-medium" for="crm-ping-filter">
                Next ping
              </label>
              <select
                id="crm-ping-filter"
                class={selectClass}
                value={pingFilter()}
                onChange={(event) => setPingFilter(event.currentTarget.value)}
              >
                <option value="">Any ping</option>
                <For each={PING_FILTERS}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </select>
            </div>
            <div class="flex w-[260px] flex-col gap-2">
              <label class="text-sm font-medium" for="crm-search">
                Search
              </label>
              <input
                id="crm-search"
                class={inputClass}
                type="search"
                value={searchDraft()}
                placeholder="Name, email or telegram"
                onInput={(event) => setSearchDraft(event.currentTarget.value)}
              />
            </div>
            <Button type="submit" variant="outline" disabled={loading()}>
              Apply
            </Button>
          </form>

          <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
            <Table class="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[20%]">Contact</TableHead>
                  <TableHead class="w-[16%]">Telegram</TableHead>
                  <TableHead class="w-[16%]">Status</TableHead>
                  <TableHead class="w-[14%]">Next ping</TableHead>
                  <TableHead class="w-[24%]">Last note</TableHead>
                  <TableHead class="w-[10%] text-right">Log</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Index each={items()}>
                  {(contact) => {
                    const row = () => contact();
                    const isSaving = () => savingId() === row().id;
                    const isExpanded = () => expandedId() === row().id;
                    return (
                      <>
                        <TableRow>
                          <TableCell class="w-[20%] align-top">
                            <div class="font-medium">{row().name || "—"}</div>
                            <Show when={row().email}>
                              <div class="text-xs text-muted-foreground">
                                {row().email}
                              </div>
                            </Show>
                            <Show when={row().userUid}>
                              <a
                                href={`/admin/students/${row().userUid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center gap-1 text-xs text-primary underline"
                              >
                                <span>Account</span>
                                <Icon name="open_in_new" class="text-[12px]" />
                              </a>
                            </Show>
                          </TableCell>
                          <TableCell class="w-[16%] align-top">
                            {row().telegram || "—"}
                          </TableCell>
                          <TableCell class="w-[16%] align-top">
                            <select
                              class={selectClass}
                              aria-label={`Status of ${row().name || row().id}`}
                              value={row().status ?? ""}
                              disabled={isSaving()}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                void applyPatch(
                                  row(),
                                  {
                                    status: (value || null) as CrmContactStatus | null,
                                  },
                                  "Status updated",
                                );
                              }}
                            >
                              <option value="">No status</option>
                              <For each={statuses()}>
                                {(option) => (
                                  <option value={option.value}>{option.label}</option>
                                )}
                              </For>
                            </select>
                            <Show when={row().statusRaw && !statusLabel(row().status)}>
                              <div class="mt-1 text-xs text-muted-foreground">
                                was: {row().statusRaw}
                              </div>
                            </Show>
                          </TableCell>
                          <TableCell class="w-[14%] align-top">
                            <input
                              class={`${inputClass} ${pingClass(row().nextPingAt)}`}
                              type="date"
                              aria-label={`Next ping for ${row().name || row().id}`}
                              value={row().nextPingAt ?? ""}
                              disabled={isSaving()}
                              onChange={(event) => {
                                void applyPatch(
                                  row(),
                                  { nextPingAt: event.currentTarget.value || null },
                                  "Ping updated",
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell class="w-[24%] align-top">
                            <div class="line-clamp-3 text-sm text-muted-foreground">
                              {row().lastNoteText || "—"}
                            </div>
                            <Show when={row().lastNoteAt}>
                              <div class="text-xs text-muted-foreground">
                                {formatDate(row().lastNoteAt as string)}
                              </div>
                            </Show>
                          </TableCell>
                          <TableCell class="w-[10%] text-right align-top">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Open log for ${row().name || row().id}`}
                              title="Feedback log"
                              onClick={() => void openNotes(row())}
                            >
                              <Icon
                                name={isExpanded() ? "expand_less" : "expand_more"}
                                class="text-[18px]"
                              />
                            </Button>
                          </TableCell>
                        </TableRow>
                        <Show when={isExpanded()}>
                          <TableRow>
                            <TableCell colSpan={6} class="bg-muted/30">
                              <div class="grid gap-6 lg:grid-cols-2">
                                <div class="space-y-3">
                                  <div class="text-sm font-semibold">Contact details</div>
                                  <div class="grid gap-3 sm:grid-cols-2">
                                    <label class="flex flex-col gap-1 text-xs font-medium">
                                      Name
                                      <input
                                        class={inputClass}
                                        value={fieldsDraft().name ?? ""}
                                        onInput={(event) =>
                                          setFieldsDraft((prev) => ({
                                            ...prev,
                                            name: event.currentTarget.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <label class="flex flex-col gap-1 text-xs font-medium">
                                      Email
                                      <input
                                        class={inputClass}
                                        type="email"
                                        value={fieldsDraft().email ?? ""}
                                        onInput={(event) =>
                                          setFieldsDraft((prev) => ({
                                            ...prev,
                                            email: event.currentTarget.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <label class="flex flex-col gap-1 text-xs font-medium">
                                      Telegram
                                      <input
                                        class={inputClass}
                                        value={fieldsDraft().telegram ?? ""}
                                        onInput={(event) =>
                                          setFieldsDraft((prev) => ({
                                            ...prev,
                                            telegram: event.currentTarget.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <label class="flex flex-col gap-1 text-xs font-medium">
                                      Channel URL
                                      <input
                                        class={inputClass}
                                        type="url"
                                        placeholder="https://..."
                                        value={fieldsDraft().channelUrl ?? ""}
                                        onInput={(event) =>
                                          setFieldsDraft((prev) => ({
                                            ...prev,
                                            channelUrl: event.currentTarget.value,
                                          }))
                                        }
                                      />
                                    </label>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => void saveFields(row())}
                                    disabled={isSaving()}
                                  >
                                    Save details
                                  </Button>
                                </div>
                                <div class="space-y-3">
                                  <div class="text-sm font-semibold">Feedback log</div>
                                  <div class="flex gap-2">
                                    <textarea
                                      class="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      rows={2}
                                      placeholder="Add a note"
                                      aria-label="New note"
                                      value={noteDraft()}
                                      onInput={(event) =>
                                        setNoteDraft(event.currentTarget.value)
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => void submitNote(row())}
                                      disabled={savingNote() || !noteDraft().trim()}
                                    >
                                      Add
                                    </Button>
                                  </div>
                                  <Show
                                    when={!notesLoading()}
                                    fallback={<div class="text-sm">Loading…</div>}
                                  >
                                    <Show
                                      when={notes().length > 0}
                                      fallback={
                                        <div class="text-sm text-muted-foreground">
                                          No notes yet.
                                        </div>
                                      }
                                    >
                                      <ul class="space-y-2">
                                        <For each={notes()}>
                                          {(note) => (
                                            <li class="rounded-md border border-border/70 px-3 py-2">
                                              <div class="flex items-start justify-between gap-2">
                                                <div class="whitespace-pre-wrap text-sm">
                                                  {note.text}
                                                </div>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  aria-label={`Delete note ${note.id}`}
                                                  title="Delete note"
                                                  onClick={() =>
                                                    void removeNote(row(), note)
                                                  }
                                                >
                                                  <Icon
                                                    name="delete"
                                                    class="text-[16px]"
                                                  />
                                                </Button>
                                              </div>
                                              <div class="text-xs text-muted-foreground">
                                                {note.authorName}
                                                <Show when={note.createdAt}>
                                                  {" · "}
                                                  {formatDate(note.createdAt as string)}
                                                </Show>
                                                <Show when={note.imported}>
                                                  {" · imported"}
                                                </Show>
                                              </div>
                                            </li>
                                          )}
                                        </For>
                                      </ul>
                                    </Show>
                                  </Show>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </Show>
                      </>
                    );
                  }}
                </Index>
              </TableBody>
            </Table>
            <Show when={items().length === 0}>
              <div class="mt-4 text-sm text-muted-foreground">No contacts found.</div>
            </Show>
            <Show when={nextCursor()}>
              <div class="mt-4">
                <Button
                  variant="outline"
                  onClick={() => void loadMore()}
                  disabled={loadingMore()}
                >
                  Load more
                </Button>
              </div>
            </Show>
          </Show>
        </SectionCard>
      </Show>

      <Dialog open={createOpen()} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add lead</DialogTitle>
            <DialogDescription>
              Name, email or telegram — at least one is required so the lead can be
              reached.
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-3">
            <label class="flex flex-col gap-1 text-sm font-medium">
              Name
              <input
                class={inputClass}
                value={createDraft().name ?? ""}
                onInput={(event) =>
                  setCreateDraft((prev) => ({ ...prev, name: event.currentTarget.value }))
                }
              />
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
              Email
              <input
                class={inputClass}
                type="email"
                value={createDraft().email ?? ""}
                onInput={(event) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    email: event.currentTarget.value,
                  }))
                }
              />
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
              Telegram
              <input
                class={inputClass}
                value={createDraft().telegram ?? ""}
                onInput={(event) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    telegram: event.currentTarget.value,
                  }))
                }
              />
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
              Channel URL
              <input
                class={inputClass}
                type="url"
                placeholder="https://..."
                value={createDraft().channelUrl ?? ""}
                onInput={(event) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    channelUrl: event.currentTarget.value,
                  }))
                }
              />
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
              Status
              <select
                class={selectClass}
                value={createDraft().status ?? ""}
                onChange={(event) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    status: (event.currentTarget.value ||
                      null) as CrmContactStatus | null,
                  }))
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
                value={createDraft().nextPingAt ?? ""}
                onChange={(event) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    nextPingAt: event.currentTarget.value,
                  }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating()}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitCreate()}
              disabled={creating() || !canCreate()}
              data-testid="crm-create-submit"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
