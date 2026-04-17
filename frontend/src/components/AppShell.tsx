import type { JSX } from "solid-js";
import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  Show,
  useContext,
} from "solid-js";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { TextField, TextFieldInput } from "../components/ui/text-field";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { cn } from "../lib/utils";
import { SettingsPanel } from "./SettingsPanel";

type AppShellProps = {
  title: string;
  roleLabel: string;
  userName?: string;
  brandSlot?: JSX.Element;
  centerSlot?: JSX.Element;
  userMenuSlot?: JSX.Element;
  rightRail?: JSX.Element;
  showSettingsTrigger?: boolean;
  hideLogout?: boolean;
  headerClass?: string;
  headerInnerClass?: string;
  mainClass?: string;
  contentClass?: string;
  onLogout: () => void;
  children: JSX.Element;
};

type AppShellRailSetter = (rail: JSX.Element | null) => void;

const AppShellRailContext = createContext<AppShellRailSetter>();

export function useAppShellRail() {
  const ctx = useContext(AppShellRailContext);
  if (!ctx) {
    throw new Error("useAppShellRail must be used within AppShell");
  }
  return ctx;
}

export function AppShell(props: AppShellProps) {
  const auth = useAuth();
  const [railContent, setRailContent] = createSignal<JSX.Element | null>(null);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const [renameOpen, setRenameOpen] = createSignal(false);
  const [renameDraft, setRenameDraft] = createSignal("");
  const [renameError, setRenameError] = createSignal<string | null>(null);
  const [renameSaving, setRenameSaving] = createSignal(false);
  const activeRail = () => props.rightRail ?? railContent();
  const hasRail = () => Boolean(activeRail());
  const { t } = useI18n();
  let userMenuRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (!userMenuOpen()) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!userMenuRef?.contains(target)) setUserMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  createEffect(() => {
    if (!renameOpen()) return;
    setRenameDraft((auth.me()?.displayName || "").trim());
    setRenameError(null);
  });

  const validateDisplayName = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return t("common.valueRequired");
    if (trimmed.length > 60) return t("common.maxLength60");
    return null;
  };

  const saveDisplayName = async () => {
    if (renameSaving()) return;
    const trimmed = renameDraft().trim();
    const validation = validateDisplayName(trimmed);
    if (validation) {
      setRenameError(validation);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      await auth.updateDisplayName(trimmed);
      setRenameOpen(false);
    } catch (error) {
      setRenameError((error as Error).message || t("common.saveFailed"));
    } finally {
      setRenameSaving(false);
    }
  };

  const openRenameDialog = () => {
    setUserMenuOpen(false);
    setRenameOpen(true);
  };

  const openSettingsPanel = () => {
    setUserMenuOpen(false);
    setSettingsOpen(true);
  };

  const logout = () => {
    setUserMenuOpen(false);
    props.onLogout();
  };

  return (
    <div class="min-h-screen bg-background text-foreground">
      <header
        class={cn(
          "sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur",
          props.headerClass,
        )}
      >
        <div
          class={cn(
            "mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4",
            props.headerInnerClass,
          )}
        >
          <Show
            when={props.brandSlot}
            fallback={
              <div class="flex min-w-0 items-center gap-3">
                <Avatar class="h-9 w-9 bg-primary text-primary-foreground">
                  <AvatarFallback class="bg-primary text-primary-foreground">
                    SW
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0">
                  <div class="truncate text-lg font-semibold">{props.title}</div>
                  <div class="text-xs text-muted-foreground">
                    {props.roleLabel}
                    <Show when={props.userName}>
                      <span> · {props.userName}</span>
                    </Show>
                  </div>
                </div>
              </div>
            }
          >
            <div class="min-w-0">{props.brandSlot}</div>
          </Show>
          <Show when={props.centerSlot}>
            <div class="flex flex-1 items-center justify-center gap-2">
              {props.centerSlot}
            </div>
          </Show>
          <div class="flex items-center gap-3">
            <div class="relative" ref={userMenuRef}>
              <button
                type="button"
                class="flex items-center gap-2 rounded-[var(--radius-md)] px-1.5 py-1 text-left transition-colors duration-300 hover:bg-white/70"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen()}
                onClick={() => setUserMenuOpen((open) => !open)}
              >
                <Show
                  when={props.userMenuSlot}
                  fallback={
                    <div class="text-right">
                      <p class="text-sm font-semibold text-foreground">
                        {props.userName || props.title}
                      </p>
                      <p class="text-xs text-muted-foreground">{props.roleLabel}</p>
                    </div>
                  }
                >
                  {props.userMenuSlot}
                </Show>
                <span class="material-symbols-outlined text-[18px] text-muted-foreground">
                  expand_more
                </span>
              </button>
              <Show when={userMenuOpen()}>
                <div class="absolute right-0 top-[calc(100%+0.5rem)] z-40 min-w-[220px] rounded-[calc(var(--radius-md)+2px)] border border-border/70 bg-background p-2 shadow-card">
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent"
                    onClick={openRenameDialog}
                  >
                    <span class="material-symbols-outlined text-[18px] text-muted-foreground">
                      edit
                    </span>
                    <span>{t("common.renameUser")}</span>
                  </button>
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent"
                    onClick={openSettingsPanel}
                  >
                    <span class="material-symbols-outlined text-[18px] text-muted-foreground">
                      settings
                    </span>
                    <span>{t("common.settings")}</span>
                  </button>
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent"
                    onClick={logout}
                  >
                    <span class="material-symbols-outlined text-[18px] text-muted-foreground">
                      logout
                    </span>
                    <span>{t("common.logout")}</span>
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </header>
      <AppShellRailContext.Provider value={setRailContent}>
        <main class={cn("mx-auto w-full max-w-6xl px-6 py-8", props.mainClass)}>
          <div
            class={cn(
              `grid gap-6 ${
              hasRail() ? "lg:grid-cols-[minmax(0,1fr)_280px]" : "grid-cols-1"
              }`,
              props.contentClass,
            )}
          >
            <div class={hasRail() ? "min-w-0" : ""}>{props.children}</div>
            <Show when={activeRail()}>
              <aside class="space-y-4">{activeRail()}</aside>
            </Show>
          </div>
        </main>
      </AppShellRailContext.Provider>
      <SettingsPanel open={settingsOpen()} onOpenChange={setSettingsOpen} />
      <Dialog open={renameOpen()} onOpenChange={setRenameOpen}>
        <DialogContent class="max-w-md rounded-[calc(var(--radius-lg)+6px)] border border-border/70 bg-background p-6 shadow-card">
          <DialogHeader class="space-y-2 text-left">
            <DialogTitle class="text-2xl font-bold tracking-[-0.03em]">
              {t("common.renameUser")}
            </DialogTitle>
            <DialogDescription class="text-sm leading-6 text-muted-foreground">
              {props.roleLabel}
            </DialogDescription>
          </DialogHeader>
          <div class="space-y-2">
            <TextField>
              <TextFieldInput
                value={renameDraft()}
                onInput={(event) => setRenameDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveDisplayName();
                  }
                }}
                disabled={renameSaving()}
                maxlength={60}
                autofocus
              />
            </TextField>
            <Show when={renameError()}>
              <p class="text-xs text-error-foreground">{renameError()}</p>
            </Show>
          </div>
          <DialogFooter class="gap-2">
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renameSaving()}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveDisplayName()} disabled={renameSaving()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
