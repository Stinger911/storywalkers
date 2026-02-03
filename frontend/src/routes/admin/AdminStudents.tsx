import { createEffect, createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "../../components/ui/button";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import { listStudents, type Student } from "../../lib/adminApi";

export function AdminStudents() {
  const [items, setItems] = createSignal<Student[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStudents({ q: query() || undefined });
      setItems(data.items);
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
    <section class="space-y-6">
      <div class="rounded-2xl border bg-card p-6">
        <h2 class="text-2xl font-semibold">Students</h2>
        <p class="text-sm text-muted-foreground">
          Select a student to manage their plan.
        </p>
      </div>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <div class="rounded-2xl border bg-card p-6">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <TextField class="w-full max-w-sm">
            <TextFieldLabel for="student-search">Search</TextFieldLabel>
            <TextFieldInput
              id="student-search"
              value={query()}
              placeholder="Search by name or email"
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
          </TextField>
          <Button onClick={() => void load()} variant="outline">
            Refresh
          </Button>
        </div>

        <Show
          when={!loading()}
          fallback={<div class="mt-4 text-sm">Loading…</div>}
        >
          <div class="mt-4 grid gap-3">
            {items().map((student) => (
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
                      {student.status || "active"} · {student.role || "student"}
                    </div>
                  </div>
                  <A
                    href={`/admin/students/${student.uid}`}
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
    </section>
  );
}
