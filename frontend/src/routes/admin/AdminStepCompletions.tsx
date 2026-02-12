import { createEffect, createSignal, Show } from "solid-js";

import { Button } from "../../components/ui/button";
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
import {
  listStepCompletions,
  patchStepCompletion,
  revokeStepCompletion,
  type StepCompletion,
} from "../../lib/adminApi";
import { formatDate } from "../../lib/utils";

type CompletionStatusFilter = "completed" | "revoked" | "all";

export function AdminStepCompletions() {
  const [items, setItems] = createSignal<StepCompletion[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [statusFilter, setStatusFilter] =
    createSignal<CompletionStatusFilter>("completed");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [commentDraft, setCommentDraft] = createSignal("");
  const [linkDraft, setLinkDraft] = createSignal("");
  const [savingId, setSavingId] = createSignal<string | null>(null);
  const [revokeOpen, setRevokeOpen] = createSignal(false);
  const [revokeTarget, setRevokeTarget] = createSignal<StepCompletion | null>(null);
  const [revokingId, setRevokingId] = createSignal<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStepCompletions({
        limit: 100,
        status: statusFilter(),
      });
      setItems(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    statusFilter();
    void load();
  });

  const openEditor = (item: StepCompletion) => {
    if (savingId() || revokingId()) return;
    setEditingId(item.id);
    setCommentDraft(item.comment ?? "");
    setLinkDraft(item.link ?? "");
  };

  const cancelEditor = () => {
    if (savingId() || revokingId()) return;
    setEditingId(null);
    setCommentDraft("");
    setLinkDraft("");
  };

  const saveEditor = async (item: StepCompletion) => {
    if (savingId() || revokingId()) return;
    const nextComment = commentDraft().trim();
    const nextLink = linkDraft().trim();

    setSavingId(item.id);
    try {
      await patchStepCompletion(item.id, {
        comment: nextComment || null,
        link: nextLink || null,
      });

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                comment: nextComment || null,
                link: nextLink || null,
              }
            : row,
        ),
      );
      setEditingId(null);
      setCommentDraft("");
      setLinkDraft("");
      showToast({
        variant: "success",
        title: "Saved",
        description: "Completion updated.",
      });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Save failed",
        description: (err as Error).message || "Could not update completion.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const openRevokeDialog = (item: StepCompletion) => {
    if (savingId() || revokingId()) return;
    setRevokeTarget(item);
    setRevokeOpen(true);
  };

  const closeRevokeDialog = () => {
    if (revokingId()) return;
    setRevokeOpen(false);
    setRevokeTarget(null);
  };

  const confirmRevoke = async () => {
    const target = revokeTarget();
    if (!target || revokingId()) return;
    setRevokingId(target.id);
    try {
      await revokeStepCompletion(target.id);
      if (statusFilter() === "all") {
        setItems((prev) =>
          prev.map((row) =>
            row.id === target.id
              ? {
                  ...row,
                  status: "revoked",
                }
              : row,
          ),
        );
      } else {
        setItems((prev) => prev.filter((row) => row.id !== target.id));
      }
      if (editingId() === target.id) {
        setEditingId(null);
        setCommentDraft("");
        setLinkDraft("");
      }
      setRevokeOpen(false);
      setRevokeTarget(null);
      showToast({
        variant: "success",
        title: "Revoked",
        description: "Step completion was revoked and the step is now unmarked.",
      });
    } catch (err) {
      showToast({
        variant: "error",
        title: "Revoke failed",
        description: (err as Error).message || "Could not revoke completion.",
      });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Page
      title="Step completions"
      subtitle="Review and edit student completion comments and links."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Step completions</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <Button variant="outline" onClick={() => void load()} disabled={loading()}>
          Refresh
        </Button>
      }
    >
      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <SectionCard title="Recent completions">
        <div class="mb-4 flex max-w-[260px] flex-col gap-2">
          <label class="text-sm font-medium" for="step-completions-status-filter">
            Status
          </label>
          <select
            id="step-completions-status-filter"
            class="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter()}
            onChange={(event) =>
              setStatusFilter(event.currentTarget.value as CompletionStatusFilter)
            }
          >
            <option value="completed">Completed</option>
            <option value="revoked">Revoked</option>
            <option value="all">All</option>
          </select>
        </div>
        <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
          <Table class="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead class="w-[16%]">Student</TableHead>
                <TableHead class="w-[16%]">Step</TableHead>
                <TableHead class="w-[10%]">Status</TableHead>
                <TableHead class="w-[16%]">Completed</TableHead>
                <TableHead class="w-[16%]">Comment</TableHead>
                <TableHead class="w-[16%]">Link</TableHead>
                <TableHead class="w-[220px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items().map((item) => {
                const isEditing = () => editingId() === item.id;
                const isSaving = () => savingId() === item.id;
                const isRevoking = () => revokingId() === item.id;
                const completedDate = () =>
                  (item.completedAt ??
                    item.createdAt ??
                    null) as Date | string | number | { toDate?: () => Date } | null;
                return (
                  <TableRow>
                    <TableCell class="w-[16%]">
                      <a
                        href={`/admin/students/${item.studentUid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 font-medium text-primary underline"
                      >
                        <span>{item.studentDisplayName || "Student"}</span>
                        <span
                          class="material-symbols-outlined text-[14px]"
                          aria-hidden="true"
                        >
                          open_in_new
                        </span>
                      </a>
                    </TableCell>
                    <TableCell class="w-[16%]">
                      <div class="font-medium">{item.stepTitle || item.stepId}</div>
                      <Show when={item.goalTitle}>
                        <div class="text-xs text-muted-foreground">{item.goalTitle}</div>
                      </Show>
                    </TableCell>
                    <TableCell class="w-[10%]">{item.status}</TableCell>
                    <TableCell class="w-[16%]">{formatDate(completedDate())}</TableCell>
                    <TableCell class="w-[16%]">
                      <Show
                        when={isEditing()}
                        fallback={
                          <span class="line-clamp-3 text-sm text-muted-foreground">
                            {item.comment || "-"}
                          </span>
                        }
                      >
                        <textarea
                          class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={commentDraft()}
                          rows={3}
                          onInput={(event) =>
                            setCommentDraft(event.currentTarget.value)
                          }
                          placeholder="Comment"
                          data-testid={`edit-comment-${item.id}`}
                          disabled={isSaving()}
                        />
                      </Show>
                    </TableCell>
                    <TableCell class="w-[16%]">
                      <Show
                        when={isEditing()}
                        fallback={
                          <Show when={item.link} fallback={<span class="text-muted-foreground">-</span>}>
                            <a
                              href={item.link || "#"}
                              target="_blank"
                              rel="noreferrer"
                              class="text-primary underline"
                            >
                              {item.link}
                            </a>
                          </Show>
                        }
                      >
                        <input
                          class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          type="url"
                          value={linkDraft()}
                          onInput={(event) => setLinkDraft(event.currentTarget.value)}
                          placeholder="https://..."
                          data-testid={`edit-link-${item.id}`}
                          disabled={isSaving()}
                        />
                      </Show>
                    </TableCell>
                    <TableCell class="text-right">
                      <Show
                        when={!isEditing()}
                        fallback={
                          <div class="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Cancel edit ${item.id}`}
                              title="Cancel"
                              onClick={cancelEditor}
                              disabled={isSaving() || isRevoking()}
                            >
                              ❌
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Save edit ${item.id}`}
                              title="Save"
                              onClick={() => void saveEditor(item)}
                              disabled={isSaving() || isRevoking()}
                            >
                              ✅
                            </Button>
                          </div>
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit completion ${item.id}`}
                          title="Edit completion"
                          onClick={() => openEditor(item)}
                          disabled={Boolean(savingId()) || Boolean(revokingId())}
                        >
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                        </Button>
                        <Show when={item.status === "completed"}>
                          <Button
                            variant="destructive"
                            size="sm"
                            aria-label={`Revoke completion ${item.id}`}
                            title="Revoke completion"
                            onClick={() => openRevokeDialog(item)}
                            disabled={Boolean(savingId()) || Boolean(revokingId())}
                          >
                            Revoke
                          </Button>
                        </Show>
                      </Show>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Show when={items().length === 0}>
            <div class="mt-4 text-sm text-muted-foreground">No step completions found.</div>
          </Show>
        </Show>
      </SectionCard>

      <Dialog open={revokeOpen()} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke completion?</DialogTitle>
            <DialogDescription>
              This will unmark the student step and remove comment/link on the
              step. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRevokeDialog}
              disabled={Boolean(revokingId())}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRevoke()}
              disabled={Boolean(revokingId())}
              data-testid="revoke-confirm-button"
            >
              Confirm revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
