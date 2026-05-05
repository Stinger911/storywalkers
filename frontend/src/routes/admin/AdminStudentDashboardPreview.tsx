import { A, useParams } from "@solidjs/router";
import { Show, createEffect, createSignal, type JSX } from "solid-js";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Button } from "../../components/ui/button";
import { Loading } from "../../components/Loading";
import { Page } from "../../components/ui/page";
import { getStudent } from "../../lib/adminApi";
import type { MeProfile } from "../../lib/auth";
import { MeProvider } from "../../lib/useMe";
import { StudentHome } from "../student/StudentHome";
import { StudentLayoutRailContext } from "../student/StudentLayout";
import { AdminStudentPreviewPlanProvider } from "./AdminStudentPreviewPlanProvider";

type PreviewStudent = Pick<
  MeProfile,
  | "uid"
  | "email"
  | "displayName"
  | "role"
  | "status"
  | "roleRaw"
  | "level"
  | "selectedGoalId"
  | "selectedGoalTitle"
  | "profileForm"
  | "selectedCourses"
  | "preferredCurrency"
  | "isFirstHundred"
  | "subscriptionSelected"
>;

export function AdminStudentDashboardPreview() {
  const params = useParams();
  const uid = () => params.uid ?? "";
  const [student, setStudent] = createSignal<PreviewStudent | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [railContent, setRailContent] = createSignal<JSX.Element | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStudent(uid());
      setStudent(data as PreviewStudent);
    } catch (err) {
      setError((err as Error).message);
      setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void load();
  });

  return (
    <Page
      title="Student dashboard preview"
      subtitle="Read-only preview of the student home dashboard."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/students">Students</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/admin/students/${uid()}`}>Profile</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Dashboard preview</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <A href={`/admin/students/${uid()}`}>
          <Button variant="outline">Back to profile</Button>
        </A>
      }
    >
      <Show when={error()}>
        <div class="admin-callout admin-callout--error text-sm">{error()}</div>
      </Show>

      <Show when={!loading()} fallback={<div class="page"><Loading /></div>}>
        <Show
          when={student()}
          fallback={<div class="text-sm text-muted-foreground">Student not found.</div>}
        >
          {(previewStudent) => (
            <MeProvider
              me={() => previewStudent()}
              loading={() => false}
              refresh={load}
            >
              <StudentLayoutRailContext.Provider value={setRailContent}>
                <AdminStudentPreviewPlanProvider uid={uid()}>
                  <div class="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
                    <aside class="hidden lg:block">
                      <div class="sticky top-24 space-y-4">
                        <div class="rounded-[calc(var(--radius-lg)+4px)] border border-border/70 bg-card px-4 py-4 shadow-rail">
                          <div class="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Previewing
                          </div>
                          <div class="mt-2 text-sm font-semibold text-foreground">
                            {previewStudent().displayName || previewStudent().email}
                          </div>
                          <div class="mt-1 text-xs text-muted-foreground">
                            {previewStudent().email}
                          </div>
                        </div>
                        <Show when={railContent()}>
                          <div>{railContent()}</div>
                        </Show>
                      </div>
                    </aside>
                    <div class="min-w-0">
                      <StudentHome readOnly />
                    </div>
                  </div>
                </AdminStudentPreviewPlanProvider>
              </StudentLayoutRailContext.Provider>
            </MeProvider>
          )}
        </Show>
      </Show>
    </Page>
  );
}
