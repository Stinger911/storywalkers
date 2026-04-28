import { A, useSearchParams } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import { Skeleton } from "../../components/ui/skeleton";
import { SmallStatBadge } from "../../components/ui/small-stat-badge";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import { listStudents, type Student } from "../../lib/adminApi";

type SortBy = "createdAt" | "progress";
type SortDir = "asc" | "desc";

const SORT_BY_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "createdAt", label: "Created at" },
  { value: "progress", label: "Progress" },
];
const SORT_DIR_OPTIONS: { value: SortDir; label: string }[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "community_only", label: "Community only" },
  { value: "expired", label: "Expired" },
];

function normalizeQueryParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function normalizeSortBy(value: string): SortBy {
  return value === "progress" ? "progress" : "createdAt";
}

function normalizeSortDir(value: string): SortDir {
  return value === "asc" ? "asc" : "desc";
}

export function AdminStudents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = createSignal<Student[]>([]);
  const [staff, setStaff] = createSignal<Student[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal(normalizeQueryParam(searchParams.q));
  const [statusFilter, setStatusFilter] = createSignal(
    normalizeQueryParam(searchParams.status),
  );
  const [sortBy, setSortBy] = createSignal<SortBy>(
    normalizeSortBy(normalizeQueryParam(searchParams.sortBy)),
  );
  const [sortDir, setSortDir] = createSignal<SortDir>(
    normalizeSortDir(normalizeQueryParam(searchParams.sortDir)),
  );
  const hasActiveFilters = () => Boolean(query().trim() || statusFilter());

  const syncSearchParams = (next: {
    q?: string;
    status?: string;
    sortBy?: SortBy;
    sortDir?: SortDir;
  }) => {
    setSearchParams({
      q: next.q?.trim() ? next.q.trim() : undefined,
      status: next.status || undefined,
      sortBy: next.sortBy === "createdAt" ? undefined : next.sortBy,
      sortDir: next.sortDir === "desc" ? undefined : next.sortDir,
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const search = query().trim() || undefined;
      const status = statusFilter() || undefined;
      const [studentData, staffData] = await Promise.all([
        listStudents({
          q: search,
          status,
          role: "student",
          sortBy: sortBy(),
          sortDir: sortDir(),
        }),
        listStudents({
          q: search,
          status,
          role: "staff",
          sortBy: sortBy(),
          sortDir: sortDir(),
        }),
      ]);
      setStudents(studentData.items);
      setStaff(staffData.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void load();
  });

  const updateQuery = (value: string) => {
    setQuery(value);
    syncSearchParams({
      q: value,
      status: statusFilter(),
      sortBy: sortBy(),
      sortDir: sortDir(),
    });
  };

  const updateStatus = (value: string) => {
    setStatusFilter(value);
    syncSearchParams({
      q: query(),
      status: value,
      sortBy: sortBy(),
      sortDir: sortDir(),
    });
  };

  const updateSortBy = (value: SortBy) => {
    setSortBy(value);
    syncSearchParams({
      q: query(),
      status: statusFilter(),
      sortBy: value,
      sortDir: sortDir(),
    });
  };

  const updateSortDir = (value: SortDir) => {
    setSortDir(value);
    syncSearchParams({
      q: query(),
      status: statusFilter(),
      sortBy: sortBy(),
      sortDir: value,
    });
  };

  return (
    <Page
      title="Students"
      subtitle="Select a student to manage their plan."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Students</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <Show when={error()}>
        <div class="admin-callout admin-callout--error text-sm">
          {error()}
        </div>
      </Show>

      <SectionCard
        title="Directory"
        actions={
          <Button onClick={() => void load()} variant="outline">
            Refresh
          </Button>
        }
      >
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TextField class="w-full">
            <TextFieldLabel for="student-search">Search</TextFieldLabel>
            <TextFieldInput
              id="student-search"
              value={query()}
              placeholder="Search by name or email"
              onInput={(event) => updateQuery(event.currentTarget.value)}
            />
          </TextField>

          <TextField class="w-full">
            <TextFieldLabel for="student-status-filter">Status</TextFieldLabel>
            <select
              id="student-status-filter"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={statusFilter()}
              onChange={(event) => updateStatus(event.currentTarget.value)}
              data-testid="student-status-filter"
            >
              {STATUS_OPTIONS.map((option) => (
                <option value={option.value}>{option.label}</option>
              ))}
            </select>
          </TextField>

          <TextField class="w-full">
            <TextFieldLabel for="student-sort-by">Sort by</TextFieldLabel>
            <select
              id="student-sort-by"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={sortBy()}
              onChange={(event) => updateSortBy(event.currentTarget.value as SortBy)}
              data-testid="student-sort-by"
            >
              {SORT_BY_OPTIONS.map((option) => (
                <option value={option.value}>{option.label}</option>
              ))}
            </select>
          </TextField>

          <TextField class="w-full">
            <TextFieldLabel for="student-sort-dir">Direction</TextFieldLabel>
            <select
              id="student-sort-dir"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={sortDir()}
              onChange={(event) => updateSortDir(event.currentTarget.value as SortDir)}
              data-testid="student-sort-dir"
            >
              {SORT_DIR_OPTIONS.map((option) => (
                <option value={option.value}>{option.label}</option>
              ))}
            </select>
          </TextField>
        </div>

        <Show
          when={!loading()}
          fallback={
            <div class="mt-4 space-y-2">
              <Skeleton class="h-12 w-full rounded-[var(--radius-md)]" animate />
              <Skeleton class="h-12 w-full rounded-[var(--radius-md)]" animate />
              <Skeleton class="h-12 w-full rounded-[var(--radius-md)]" animate />
              <Skeleton class="h-12 w-full rounded-[var(--radius-md)]" animate />
              <Skeleton class="h-12 w-full rounded-[var(--radius-md)]" animate />
            </div>
          }
        >
          <div class="mt-4 grid gap-6 lg:grid-cols-2">
            <div class="space-y-3">
              <div class="text-sm font-semibold text-muted-foreground">Students</div>
              <Show
                when={students().length > 0}
                fallback={
                  <div class="py-8 text-center text-sm text-muted-foreground">
                    {hasActiveFilters()
                      ? "No students match the current filters."
                      : "No students found yet."}
                  </div>
                }
              >
                <div class="grid gap-3">
                  {students().map((student) => (
                    <div class="rounded-xl border p-4">
                      <div class="flex items-start justify-between gap-4">
                        <div>
                          <div class="flex flex-wrap items-center gap-2 text-base font-semibold">
                            {student.displayName || "Student without a name"}
                            <Show when={student.isFirstHundred === true}>
                              <span
                                class="inline-flex items-center justify-center rounded-full bg-amber-100 p-1 text-amber-700"
                                title="First 100 student"
                                aria-label="First 100 student"
                              >
                                <span class="material-symbols-outlined text-[16px]">
                                  workspace_premium
                                </span>
                              </span>
                            </Show>
                          </div>
                          <div class="text-sm text-muted-foreground">{student.email}</div>
                          <div class="text-xs text-muted-foreground">
                            {student.status || "active"} · {student.role || "student"}
                          </div>
                        </div>
                        <div class="flex flex-col items-end gap-2 text-right">
                          <A
                            href={`/admin/students/${student.uid}`}
                            class="text-sm font-medium text-primary underline"
                          >
                            Open student profile
                          </A>
                          <div class="flex flex-wrap justify-end gap-2">
                            <SmallStatBadge>{student.progressPercent ?? 0}%</SmallStatBadge>
                            <SmallStatBadge>
                              {(student.stepsDone ?? 0)}/{student.stepsTotal ?? 0}
                            </SmallStatBadge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Show>
            </div>

            <div class="space-y-3">
              <div class="text-sm font-semibold text-muted-foreground">Staff</div>
              <Show
                when={staff().length > 0}
                fallback={
                  <div class="py-8 text-center text-sm text-muted-foreground">
                    {hasActiveFilters()
                      ? "No staff members match the current filters."
                      : "No staff members found yet."}
                  </div>
                }
              >
                <div class="grid gap-3">
                  {staff().map((member) => (
                    <div class="rounded-xl border p-4">
                      <div class="flex items-start justify-between gap-4">
                        <div>
                          <div class="text-base font-semibold">
                            {member.displayName || "Unnamed user"}
                          </div>
                          <div class="text-sm text-muted-foreground">{member.email}</div>
                          <div class="text-xs text-muted-foreground">
                            {member.status || "active"} · {member.role || "staff"}
                          </div>
                        </div>
                        <A
                          href={`/admin/students/${member.uid}`}
                          class="text-sm font-medium text-primary underline"
                        >
                          Open profile
                        </A>
                      </div>
                    </div>
                  ))}
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </SectionCard>
    </Page>
  );
}
