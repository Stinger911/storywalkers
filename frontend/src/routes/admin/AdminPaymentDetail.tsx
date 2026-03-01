import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Page } from "../../components/ui/page";
import { Skeleton } from "../../components/ui/skeleton";
import { showToast } from "../../components/ui/toast";
import { formatDate } from "../../lib/utils";
import {
  activateAdminPayment,
  getAdminPayment,
  getStudent,
  rejectAdminPayment,
  type AdminPayment,
} from "../../lib/adminApi";

type StudentProfile = {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  status?: string;
};

function statusBadgeVariant(status: AdminPayment["status"]) {
  if (status === "activated") return "success";
  if (status === "rejected" || status === "failed" || status === "cancelled") {
    return "error";
  }
  if (status === "email_detected" || status === "paid") return "secondary";
  return "warning";
}

function parseEvidence(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  const entries = raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return [part, ""] as const;
      return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()] as const;
    });
  return Object.fromEntries(entries);
}

export function AdminPaymentDetail() {
  const params = useParams();
  const paymentId = () => params.id ?? "";
  const [payment, setPayment] = createSignal<AdminPayment | null>(null);
  const [student, setStudent] = createSignal<StudentProfile | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [activateConfirm, setActivateConfirm] = createSignal("");
  const [rejectReason, setRejectReason] = createSignal("");
  const [activating, setActivating] = createSignal(false);
  const [rejecting, setRejecting] = createSignal(false);

  const evidence = createMemo(() => parseEvidence(payment()?.emailEvidence));

  const copyValue = async (label: string, value?: string | null) => {
    const text = (value ?? "").toString().trim();
    if (!text) {
      showToast({
        variant: "warning",
        title: "Nothing to copy",
        description: `${label} is empty.`,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast({ variant: "success", title: `${label} copied` });
    } catch {
      showToast({
        variant: "error",
        title: "Copy failed",
        description: "Clipboard access is not available.",
      });
    }
  };

  const load = async (id: string, keepError = false) => {
    setLoading(true);
    if (!keepError) setError(null);
    setStudent(null);
    try {
      const paymentData = await getAdminPayment(id);
      setPayment(paymentData);
      try {
        const userData = await getStudent(paymentData.userUid);
        setStudent({
          uid: paymentData.userUid,
          displayName: userData.displayName,
          email: userData.email,
          role: userData.role,
          status: userData.status,
        });
      } catch {
        setStudent({
          uid: paymentData.userUid,
          displayName: undefined,
          email: undefined,
          role: undefined,
          status: undefined,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const id = paymentId();
    if (!id) return;
    void load(id);
  });

  const onActivate = async () => {
    const id = paymentId();
    if (!id || activating()) return;
    if (activateConfirm().trim() !== "ACTIVATE") {
      showToast({
        variant: "warning",
        title: "Confirmation mismatch",
        description: 'Type "ACTIVATE" to confirm activation.',
      });
      return;
    }
    setActivating(true);
    try {
      const result = await activateAdminPayment(id);
      showToast({
        variant: "success",
        title: result.result === "noop" ? "Already activated" : "Payment activated",
      });
      setActivateConfirm("");
      await load(id, true);
    } catch (err) {
      showToast({
        variant: "error",
        title: "Activation failed",
        description: (err as Error).message,
      });
    } finally {
      setActivating(false);
    }
  };

  const onReject = async () => {
    const id = paymentId();
    if (!id || rejecting()) return;
    setRejecting(true);
    try {
      const reason = rejectReason().trim();
      const result = await rejectAdminPayment(id, { reason: reason || null });
      showToast({
        variant: "success",
        title: result.result === "noop" ? "Already rejected" : "Payment rejected",
      });
      setRejectReason("");
      await load(id, true);
    } catch (err) {
      showToast({
        variant: "error",
        title: "Reject failed",
        description: (err as Error).message,
      });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <Page
      title="Payment detail"
      subtitle="Inspect payment metadata and activation evidence."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/payments">Payments</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>{params.id}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <Show
        when={!loading()}
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>Payment {params.id}</CardTitle>
              <CardDescription>Loading payment details…</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <Skeleton class="h-5 w-1/3 rounded-md" />
              <Skeleton class="h-5 w-2/3 rounded-md" />
              <Skeleton class="h-24 w-full rounded-md" />
            </CardContent>
          </Card>
        }
      >
        <div class="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
              <CardDescription>Core payment metadata.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm">
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">ID</span>
                <div class="flex items-center gap-2">
                  <code class="text-xs">{payment()?.id}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyValue("Payment ID", payment()?.id)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Status</span>
                <Badge variant={statusBadgeVariant(payment()?.status || "created")}>
                  {payment()?.status || "-"}
                </Badge>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Activation code</span>
                <div class="flex items-center gap-2">
                  <code class="text-xs">{payment()?.activationCode || "-"}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void copyValue("Activation code", payment()?.activationCode)
                    }
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Amount</span>
                <span>
                  {payment()?.amount} {payment()?.currency}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Provider</span>
                <span class="uppercase">{payment()?.provider || "-"}</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Created</span>
                <span>{formatDate(payment()?.createdAt as never) || "-"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User</CardTitle>
              <CardDescription>Linked account information.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm">
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">UID</span>
                <div class="flex items-center gap-2">
                  <code class="text-xs">{payment()?.userUid || "-"}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyValue("User UID", payment()?.userUid)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Email</span>
                <span>{student()?.email || payment()?.email || "-"}</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Display name</span>
                <span>{student()?.displayName || "-"}</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Role</span>
                <span>{student()?.role || "-"}</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-foreground">Status</span>
                <span>{student()?.status || "-"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
              <CardDescription>Parsed email evidence from Gmail webhook.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm">
              <Show
                when={Object.keys(evidence()).length > 0}
                fallback={
                  <div class="rounded-md border border-border/70 p-3 text-muted-foreground">
                    No evidence recorded.
                  </div>
                }
              >
                <For each={Object.entries(evidence())}>
                  {([key, value]) => (
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-muted-foreground">{key}</span>
                      <div class="flex items-center gap-2">
                        <code class="max-w-[220px] truncate text-xs">{value || "-"}</code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void copyValue(key, value)}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
              <div class="rounded-md border border-border/70 p-3">
                <div class="mb-1 text-xs font-medium text-muted-foreground">Snippet</div>
                <div class="text-sm">
                  {evidence().snippet || payment()?.emailEvidence || "-"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Manual payment moderation actions.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4 md:grid-cols-2">
            <div class="space-y-3 rounded-xl border border-border/70 p-4">
              <div>
                <div class="text-sm font-medium">Activate</div>
                <p class="text-xs text-muted-foreground">
                  Type <code>ACTIVATE</code> to confirm and activate this user.
                </p>
              </div>
              <input
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={activateConfirm()}
                onInput={(event) => setActivateConfirm(event.currentTarget.value)}
                placeholder="ACTIVATE"
                disabled={activating() || rejecting()}
              />
              <Button
                onClick={() => void onActivate()}
                disabled={activating() || rejecting() || !paymentId()}
              >
                {activating() ? "Activating..." : "Activate"}
              </Button>
            </div>

            <div class="space-y-3 rounded-xl border border-border/70 p-4">
              <div>
                <div class="text-sm font-medium">Reject</div>
                <p class="text-xs text-muted-foreground">
                  Optionally provide a rejection reason for audit history.
                </p>
              </div>
              <textarea
                class="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={rejectReason()}
                onInput={(event) => setRejectReason(event.currentTarget.value)}
                placeholder="Reason (optional)"
                rows={4}
                disabled={activating() || rejecting()}
              />
              <Button
                variant="destructive"
                onClick={() => void onReject()}
                disabled={activating() || rejecting() || !paymentId()}
              >
                {rejecting() ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <A href="/admin/payments" class="inline-block text-sm text-primary underline">
          Back to payments
        </A>
      </Show>
    </Page>
  );
}
