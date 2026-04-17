import { A, useLocation } from "@solidjs/router";
import { createMemo, type JSX } from "solid-js";
import { AppShell } from "../../components/AppShell";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { cn } from "../../lib/utils";
import { RequireAuth } from "../RequireAuth";

type StudentLayoutProps = {
  children?: JSX.Element;
  rightRail?: JSX.Element;
};

export function StudentLayout(props: StudentLayoutProps) {
  const auth = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const { theme } = useTheme();
  const studentNavItems = createMemo(() => [
    { href: "/student", label: t("student.layout.navDashboard"), icon: "dashboard" },
    { href: "/student/courses", label: t("student.layout.navCourses"), icon: "school" },
    { href: "/student/library", label: t("student.layout.navLibrary"), icon: "local_library" },
    { href: "/student/questions", label: t("student.layout.navCommunity"), icon: "group" },
  ]);

  const currentPath = () => location.pathname;
  const isActive = (href: string) =>
    currentPath() === href || currentPath().startsWith(`${href}/`);
  const userInitials = () =>
    (auth.me()?.displayName || "Student")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  const firstName = createMemo(
    () => auth.me()?.displayName?.trim().split(/\s+/)[0] || t("student.home.fallbackName"),
  );
  const studentLevel = createMemo(() => {
    const rawLevel = auth.me()?.level;
    return typeof rawLevel === "number" && rawLevel > 0 ? Math.floor(rawLevel) : 1;
  });

  const themeStyles = () =>
    theme() === "dark"
      ? {
          "--background": "214 24% 10%",
          "--foreground": "210 40% 96%",
          "--muted": "214 22% 18%",
          "--muted-foreground": "214 16% 72%",
          "--popover": "214 26% 12%",
          "--popover-foreground": "210 40% 96%",
          "--border": "214 18% 22%",
          "--input": "214 20% 18%",
          "--card": "214 24% 13%",
          "--card-foreground": "210 40% 96%",
          "--primary": "209 52% 66%",
          "--primary-foreground": "214 26% 12%",
          "--secondary": "212 90% 68%",
          "--secondary-foreground": "214 26% 12%",
          "--accent": "214 20% 18%",
          "--accent-foreground": "210 40% 96%",
          "--ring": "209 52% 66%",
          "--radius": "0.5rem",
          "--radius-lg": "1.5rem",
          "--radius-md": "0.875rem",
          "--shadow-card": "0 20px 40px rgba(0, 0, 0, 0.28)",
          "--shadow-rail": "0 12px 28px rgba(0, 0, 0, 0.24)",
        }
      : {
          "--background": "220 44% 98%",
          "--foreground": "210 35% 11%",
          "--muted": "214 48% 95%",
          "--muted-foreground": "217 9% 33%",
          "--popover": "0 0% 100%",
          "--popover-foreground": "210 35% 11%",
          "--border": "217 27% 87%",
          "--input": "215 45% 91%",
          "--card": "0 0% 100%",
          "--card-foreground": "210 35% 11%",
          "--primary": "209 50% 37%",
          "--primary-foreground": "0 0% 100%",
          "--secondary": "212 100% 37%",
          "--secondary-foreground": "0 0% 100%",
          "--accent": "214 48% 95%",
          "--accent-foreground": "210 35% 11%",
          "--ring": "209 50% 37%",
          "--radius": "0.5rem",
          "--radius-lg": "1.5rem",
          "--radius-md": "0.875rem",
          "--shadow-card": "0 20px 40px rgba(18, 29, 38, 0.05)",
          "--shadow-rail": "0 12px 28px rgba(18, 29, 38, 0.05)",
        };

  const shell = (
    <div
      class="student-shell min-h-screen bg-background text-foreground [font-family:Manrope,'Space_Grotesk',system-ui,sans-serif]"
      style={themeStyles()}
    >
      <AppShell
        title={t("student.layout.title")}
        roleLabel={t("student.layout.roleLabel")}
        userName={auth.me()?.displayName}
        showSettingsTrigger
        brandSlot={
          <div class="flex items-center gap-8">
            <A
              href="/student"
              class="text-xl font-extrabold tracking-[-0.04em] text-[#1f3b67]"
            >
              {t("student.layout.brand")}
            </A>
          </div>
        }
        hideLogout
        headerClass="border-b-0 bg-background/70"
        headerInnerClass="max-w-[1280px] px-4 py-3 sm:px-6 lg:px-8"
        mainClass={cn(
          "max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
          props.rightRail ? "pb-24 md:pb-8" : "pb-24 md:pb-8",
        )}
        centerSlot={
          <div class="hidden md:flex flex-1 justify-center">
            <div class="flex w-full max-w-xs items-center gap-2 rounded-[var(--radius-md)] bg-[rgba(223,233,247,0.8)] px-4 py-2.5 text-muted-foreground">
              <span class="material-symbols-outlined text-[18px]">search</span>
              <input
                type="search"
                placeholder={t("student.layout.searchPlaceholder")}
                class="w-full border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        }
        userMenuSlot={
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-3">
              <div class="hidden text-right sm:block">
                <p class="text-xs font-bold leading-none text-foreground">
                  {auth.me()?.displayName || firstName()}
                </p>
                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                  {t("student.layout.levelLabel", { level: studentLevel() })}
                </p>
              </div>
              <Avatar class="h-10 w-10 rounded-[var(--radius-md)] bg-[rgba(217,227,241,0.95)]">
                <AvatarFallback class="bg-[rgba(217,227,241,0.95)] text-xs font-bold text-primary">
                  {userInitials()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        }
        rightRail={props.rightRail}
        onLogout={() => {
          void auth.logout();
          window.location.href = "/";
        }}
      >
        <div class="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          <aside class="hidden md:flex md:min-h-[calc(100vh-8rem)] md:flex-col md:justify-between px-2 py-4">
            <div class="space-y-7">
              <div class="px-2">
                <div class="text-[1.05rem] font-extrabold tracking-[-0.03em] text-[#1f3b67]">
                  {t("student.layout.workspaceTitle")}
                </div>
                <div class="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                  {t("student.layout.workspaceSubtitle")}
                </div>
              </div>
              <nav class="grid gap-1">
                {studentNavItems().map((item) => (
                  <A
                    href={item.href}
                    class={cn(
                      "flex items-center gap-3 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-all duration-300 hover:bg-white/60 hover:text-primary",
                      isActive(item.href)
                        ? "border-r-4 border-secondary bg-[rgba(237,244,255,0.7)] text-secondary"
                        : "",
                    )}
                  >
                    <span class="material-symbols-outlined text-[18px]">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </A>
                ))}
              </nav>
            </div>

            <div class="space-y-3 px-2">
              <div class="rounded-[var(--radius-lg)] bg-[rgba(223,233,247,0.82)] p-4">
                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                  {t("student.layout.tipTitle")}
                </p>
                <p class="mt-2 text-xs leading-6 text-muted-foreground">
                  {t("student.layout.tipBody")}
                </p>
              </div>
              <Button
                variant="outline"
                class="w-full justify-center rounded-[var(--radius-md)] border-border/60 bg-white/80"
                onClick={() => {
                  void auth.logout();
                  window.location.href = "/";
                }}
              >
                {t("student.layout.logout")}
              </Button>
            </div>
          </aside>
          <div class="min-w-0">{props.children}</div>
        </div>
      </AppShell>

      <nav class="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-around bg-white/90 px-4 backdrop-blur-xl md:hidden">
        {studentNavItems().map((item) => (
          <A
            href={item.href}
            class={cn(
              "flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
              isActive(item.href) ? "text-secondary" : "",
            )}
          >
            <span class="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span>{item.label}</span>
          </A>
        ))}
      </nav>
    </div>
  );

  return <RequireAuth role="student">{shell}</RequireAuth>;
}
