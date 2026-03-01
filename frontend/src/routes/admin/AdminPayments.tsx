import { createEffect, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { formatDate } from "../../lib/utils";
import {
  listAdminPayments,
  type AdminPayment,
  type PaymentStatus,
} from "../../lib/adminApi";

const STATUS_OPTIONS: { value: "all" | PaymentStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "created", label: "Created" },
  { value: "email_detected", label: "Email detected" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "activated", label: "Activated" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

function statusBadgeVariant(status: PaymentStatus) {
  if (status === "activated") return "success";
  if (status === "rejected" || status === "failed" || status === "cancelled") {
    return "error";
  }
  if (status === "email_detected" || status === "paid") return "secondary";
  return "warning";
}

export function AdminPayments() {
  const [items, setItems] = createSignal<AdminPayment[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [statusFilter, setStatusFilter] = createSignal<"all" | PaymentStatus>("all");
  const [queryDraft, setQueryDraft] = createSignal("");
  const [query, setQuery] = createSignal("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedStatus = statusFilter();
      const data = await listAdminPayments({
        status: selectedStatus === "all" ? undefined : selectedStatus,
        q: query().trim() || undefined,
        limit: 100,
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
    query();
    void load();
  });

  const applySearch = () => setQuery(queryDraft());

  const onSearchKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applySearch();
    }
  };

  return (
    <Page
      title="Payments"
      subtitle="Review payment records and activation lifecycle."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Payments</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <div class="flex items-center gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading()}>
            Refresh
          </Button>
        </div>
      }
    >
      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <Card>
        <CardHeader>
          <CardTitle>Payments list</CardTitle>
          <CardDescription>Filter by status or search by email/code.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
            <div class="grid gap-1">
              <label class="text-sm font-medium" for="payments-status-filter">
                Status
              </label>
              <select
                id="payments-status-filter"
                class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter()}
                onChange={(event) =>
                  setStatusFilter(event.currentTarget.value as "all" | PaymentStatus)
                }
              >
                <For each={STATUS_OPTIONS}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </select>
            </div>

            <div class="grid gap-1">
              <label class="text-sm font-medium" for="payments-search">
                Search
              </label>
              <input
                id="payments-search"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="email, uid, activation code"
                value={queryDraft()}
                onInput={(event) => setQueryDraft(event.currentTarget.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>

            <div class="flex items-end">
              <Button variant="outline" onClick={applySearch} disabled={loading()}>
                Search
              </Button>
            </div>
          </div>

          <Show
            when={!loading()}
            fallback={
              <div class="space-y-2">
                <Skeleton class="h-10 w-full rounded-md" />
                <Skeleton class="h-12 w-full rounded-md" />
                <Skeleton class="h-12 w-full rounded-md" />
                <Skeleton class="h-12 w-full rounded-md" />
              </div>
            }
          >
            <Show
              when={items().length > 0}
              fallback={
                <div class="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                  No payments found for current filters.
                </div>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead class="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={items()}>
                    {(item) => (
                      <TableRow>
                        <TableCell>{formatDate(item.createdAt as never) || "-"}</TableCell>
                        <TableCell>
                          <div class="font-medium">{item.email || "-"}</div>
                          <div class="text-xs text-muted-foreground">{item.userUid}</div>
                        </TableCell>
                        <TableCell class="uppercase">{item.provider}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(item.status)}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.amount} {item.currency}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.emailEvidence ? "success" : "outline"}>
                            {item.emailEvidence ? "has evidence" : "none"}
                          </Badge>
                        </TableCell>
                        <TableCell class="text-right">
                          <A
                            href={`/admin/payments/${item.id}`}
                            class="text-sm text-primary underline"
                          >
                            Open
                          </A>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </Show>
          </Show>

          <A href="/admin" class="inline-block text-sm text-primary underline">
            Back to admin
          </A>
        </CardContent>
      </Card>
    </Page>
  );
}
