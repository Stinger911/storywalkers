import { createEffect, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";

import { Badge } from "../../components/ui/badge";
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
import { showToast } from "../../components/ui/toast";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import {
  createReferral,
  listReferrals,
  updateReferral,
  type ReferralSource,
} from "../../lib/adminApi";

type ReferralForm = {
  code: string;
  name: string;
  kind: string;
  notes: string;
};

const emptyForm: ReferralForm = { code: "", name: "", kind: "partner", notes: "" };

export function AdminReferrals() {
  const [items, setItems] = createSignal<ReferralSource[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [form, setForm] = createSignal<ReferralForm>(emptyForm);
  const [editingCode, setEditingCode] = createSignal<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReferrals();
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

  const resetForm = () => {
    setEditingCode(null);
    setForm(emptyForm);
  };

  const selectItem = (item: ReferralSource) => {
    setEditingCode(item.code);
    setForm({
      code: item.code,
      name: item.name,
      kind: item.kind,
      notes: item.notes ?? "",
    });
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = form();
      if (!payload.name.trim()) {
        throw new Error("Name is required.");
      }
      if (editingCode()) {
        await updateReferral(editingCode()!, {
          name: payload.name.trim(),
          notes: payload.notes.trim() || null,
        });
      } else {
        if (!payload.code.trim()) {
          throw new Error("Code is required.");
        }
        await createReferral({
          code: payload.code.trim(),
          name: payload.name.trim(),
          kind: payload.kind.trim() || "partner",
          notes: payload.notes.trim() || null,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: ReferralSource) => {
    setSaving(true);
    setError(null);
    try {
      await updateReferral(item.code, {
        status: item.status === "active" ? "inactive" : "active",
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (code: string) => {
    const link = `${window.location.origin}/login?ref=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast({ variant: "success", title: "Link copied", description: link });
    } catch {
      showToast({ variant: "warning", title: "Could not copy link" });
    }
  };

  return (
    <Page
      title="Referrals"
      subtitle="Create referral codes for partners and track how many students registered through each link."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Referrals</BreadcrumbLink>
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

      <div class="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <SectionCard
          title="All referral codes"
          actions={
            <Button variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          }
        >
          <Show
            when={!loading()}
            fallback={<div class="mt-4 text-sm">Loading…</div>}
          >
            <Show
              when={items().length > 0}
              fallback={
                <div class="mt-4 rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                  No referral codes yet.
                </div>
              }
            >
              <div class="mt-4 grid gap-3">
                <For each={items()}>
                  {(item) => (
                    <div class="admin-list-card rounded-xl border p-4">
                      <div class="flex items-start justify-between gap-4">
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-base font-semibold">{item.name}</span>
                            <Badge variant={item.status === "active" ? "success" : "secondary"}>
                              {item.status}
                            </Badge>
                          </div>
                          <div class="text-xs text-muted-foreground">
                            {item.kind} · code: {item.code}
                          </div>
                          <div class="mt-1 text-sm">
                            {item.registrations} registration{item.registrations === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div class="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void copyLink(item.code)}
                          >
                            Copy link
                          </Button>
                          <Button variant="outline" size="sm" as={A} href={`/admin/referrals/${item.code}`}>
                            View registrations
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectItem(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void toggleStatus(item)}
                          >
                            {item.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </SectionCard>

        <SectionCard title={`${editingCode() ? "Edit" : "New"} referral code`}>
          <div class="mt-4 grid gap-4">
            <Show when={!editingCode()}>
              <TextField>
                <TextFieldLabel for="referral-code">Code</TextFieldLabel>
                <TextFieldInput
                  id="referral-code"
                  value={form().code}
                  onInput={(e) =>
                    setForm({ ...form(), code: e.currentTarget.value })
                  }
                  placeholder="anna"
                />
              </TextField>
            </Show>
            <TextField>
              <TextFieldLabel for="referral-name">Partner name</TextFieldLabel>
              <TextFieldInput
                id="referral-name"
                value={form().name}
                onInput={(e) =>
                  setForm({ ...form(), name: e.currentTarget.value })
                }
                placeholder="Anna Ivanova"
              />
            </TextField>
            <Show when={!editingCode()}>
              <TextField>
                <TextFieldLabel for="referral-kind">Kind</TextFieldLabel>
                <TextFieldInput
                  id="referral-kind"
                  value={form().kind}
                  onInput={(e) =>
                    setForm({ ...form(), kind: e.currentTarget.value })
                  }
                  placeholder="partner"
                />
              </TextField>
            </Show>
            <TextField>
              <TextFieldLabel for="referral-notes">Notes</TextFieldLabel>
              <TextFieldInput
                id="referral-notes"
                value={form().notes}
                onInput={(e) =>
                  setForm({ ...form(), notes: e.currentTarget.value })
                }
                placeholder="Instagram campaign"
              />
            </TextField>
            <div class="flex flex-wrap gap-2">
              <Button onClick={() => void submit()} disabled={saving()}>
                {editingCode() ? "Save changes" : "Create referral code"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Clear
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </Page>
  );
}
