import { createEffect, createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import { SmallStatBadge } from "../../components/ui/small-stat-badge";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { listStudents, type Student } from "../../lib/adminApi";

export function AdminStudents() {
  const [students, setStudents] = createSignal<Student[]>([]);
  const [staff, setStaff] = createSignal<Student[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const search = query() || undefined;
      const [studentData, staffData] = await Promise.all([
        listStudents({ q: search, role: "student" }),
        listStudents({ q: search, role: "staff" }),
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
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
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
        <TextField class="w-full max-w-sm">
          <TextFieldLabel for="student-search">Search</TextFieldLabel>
          <TextFieldInput
            id="student-search"
            value={query()}
            placeholder="Search by name or email"
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </TextField>

        <Show
          when={!loading()}
          fallback={<div class="mt-4 text-sm">Loading…</div>}
        >
          <div class="mt-4 grid gap-6 lg:grid-cols-2">
            <div class="space-y-3">
              <div class="text-sm font-semibold text-muted-foreground">
                Students
              </div>
              <div class="grid gap-3">
                {students().map((student) => (
                  <div class="rounded-xl border p-4">
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <div class="text-base font-semibold">
                          {student.displayName || "Unnamed student"}
                        </div>
                        <div class="text-sm text-muted-foreground">
                          {student.email}
                        </div>
                        <div class="text-xs text-muted-foreground">
                          {student.status || "active"} ·{" "}
                          {student.role || "student"}
                        </div>
                      </div>
                      <div class="flex flex-col items-end gap-2 text-right">
                        <A
                          href={`/admin/students/${student.uid}`}
                          class="text-sm font-medium text-primary underline"
                        >
                          Open profile
                        </A>
                        <div class="flex flex-wrap justify-end gap-2">
                          <SmallStatBadge>
                            {student.progressPercent ?? 0}%
                          </SmallStatBadge>
                          <SmallStatBadge>
                            {(student.stepsDone ?? 0)}/{student.stepsTotal ?? 0}
                          </SmallStatBadge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div class="space-y-3">
              <div class="text-sm font-semibold text-muted-foreground">
                Staff
              </div>
              <div class="grid gap-3">
                {staff().map((member) => (
                  <div class="rounded-xl border p-4">
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <div class="text-base font-semibold">
                          {member.displayName || "Unnamed user"}
                        </div>
                        <div class="text-sm text-muted-foreground">
                          {member.email}
                        </div>
                        <div class="text-xs text-muted-foreground">
                          {member.status || "active"} ·{" "}
                          {member.role || "staff"}
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
            </div>
          </div>
        </Show>
      </SectionCard>
    </Page>
  );
}
