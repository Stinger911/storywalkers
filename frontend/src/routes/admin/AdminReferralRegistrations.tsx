import { createEffect, createSignal, For, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
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
  listReferralRegistrations,
  type ReferralRegistration,
} from "../../lib/adminApi";

export function AdminReferralRegistrations() {
  const params = useParams();
  const code = () => params.code ?? "";
  const [items, setItems] = createSignal<ReferralRegistration[]>([]);
  const [nextCursor, setNextCursor] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReferralRegistrations(code(), { limit: 50 });
      setItems(data.items);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const cursor = nextCursor();
    if (!cursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await listReferralRegistrations(code(), { limit: 50, cursor });
      setItems([...items(), ...data.items]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  createEffect(() => {
    code();
    void load();
  });

  return (
    <Page
      title={`Registrations: ${code()}`}
      subtitle="Students who registered through this referral link."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/referrals">Referrals</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>{code()}</BreadcrumbLink>
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

      <Card>
        <CardHeader>
          <CardTitle>Registered students</CardTitle>
          <CardDescription>Sorted by registration date, newest first.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <Show
            when={!loading()}
            fallback={
              <div class="space-y-2">
                <Skeleton class="h-10 w-full rounded-md" />
                <Skeleton class="h-12 w-full rounded-md" />
                <Skeleton class="h-12 w-full rounded-md" />
              </div>
            }
          >
            <Show
              when={items().length > 0}
              fallback={
                <div class="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                  No registrations yet for this referral code.
                </div>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registered</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead class="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={items()}>
                    {(item) => (
                      <TableRow>
                        <TableCell>{formatDate(item.createdAt as never) || "-"}</TableCell>
                        <TableCell>
                          <div class="font-medium">{item.displayName || item.email || "-"}</div>
                          <div class="text-xs text-muted-foreground">{item.email}</div>
                        </TableCell>
                        <TableCell>{item.status || "-"}</TableCell>
                        <TableCell>{item.selectedCourses.length}</TableCell>
                        <TableCell class="text-right">
                          <A
                            href={`/admin/students/${item.uid}`}
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
              <Show when={nextCursor()}>
                <Button
                  variant="outline"
                  onClick={() => void loadMore()}
                  disabled={loadingMore()}
                >
                  Load more
                </Button>
              </Show>
            </Show>
          </Show>

          <A href="/admin/referrals" class="inline-block text-sm text-primary underline">
            Back to referrals
          </A>
        </CardContent>
      </Card>
    </Page>
  );
}
