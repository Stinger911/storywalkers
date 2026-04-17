import type { JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { AppShell } from "../../components/AppShell";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { RequireAuth } from "../RequireAuth";
import { cn } from "../../lib/utils";

type AdminLayoutProps = {
  children?: JSX.Element;
};

const adminNavItems = [
  { href: "/admin/students", label: "Students", icon: "group" },
  { href: "/admin/questions", label: "Questions", icon: "quiz" },
  { href: "/admin/library", label: "Library", icon: "menu_book" },
  { href: "/admin/categories", label: "Categories", icon: "category" },
  { href: "/admin/goals", label: "Goals", icon: "flag" },
  { href: "/admin/courses", label: "Courses", icon: "school" },
  {
    href: "/admin/step-completions",
    label: "Lesson Completions",
    icon: "fact_check",
  },
  { href: "/admin/payments", label: "Payments", icon: "payments" },
] as const;

export function AdminLayout(props: AdminLayoutProps) {
  const auth = useAuth();
  const location = useLocation();
  const { theme } = useTheme();

  const currentPath = () => location.pathname;
  const isActive = (href: string) =>
    currentPath() === href ||
    (href !== "/admin/home" &&
      href !== "/admin" &&
      currentPath().startsWith(`${href}/`));
  const userInitials = () =>
    (auth.me()?.displayName || "Admin")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

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

  return (
    <RequireAuth role="staff">
      <div
        class="admin-shell min-h-screen bg-background text-foreground [font-family:Manrope,'Space_Grotesk',system-ui,sans-serif]"
        style={themeStyles()}
      >
        <AppShell
          title="StoryWalkers Club"
          roleLabel="Admin Console"
          userName={auth.me()?.displayName}
          showSettingsTrigger
          hideLogout
          headerClass="border-b-0 bg-background/70"
          headerInnerClass="max-w-[1400px] px-4 py-3 sm:px-6 lg:px-8"
          mainClass="max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          centerSlot={
            <div class="hidden lg:flex flex-1 justify-center">
              <div class="flex w-full max-w-sm items-center gap-2 rounded-[var(--radius-md)] bg-[rgba(223,233,247,0.8)] px-4 py-2.5 text-muted-foreground">
                <span class="material-symbols-outlined text-[18px]">search</span>
                <input
                  type="search"
                  placeholder="Search records..."
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
                    {auth.me()?.displayName || "Admin User"}
                  </p>
                  <p class="text-[10px] text-muted-foreground">
                    Senior Curator
                  </p>
                </div>
                <Avatar class="h-9 w-9 rounded-[var(--radius-md)] border-2 border-white bg-primary/20 text-primary">
                  <AvatarFallback class="bg-primary/15 text-xs font-bold text-primary">
                    {userInitials()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          }
          onLogout={() => {
            void auth.logout();
            window.location.href = "/";
          }}
        >
          <div class="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
            <aside class="hidden md:flex md:min-h-[calc(100vh-8rem)] md:flex-col md:justify-between rounded-[calc(var(--radius-lg)+6px)] bg-[linear-gradient(180deg,rgba(237,244,255,0.92)_0%,rgba(247,249,255,0.86)_100%)] px-4 py-5">
              <div class="space-y-6">
                <div class="px-2">
                  <div class="flex items-center gap-3">
                    <div class="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-foreground">
                      <span class="material-symbols-outlined text-[22px]">
                        auto_stories
                      </span>
                    </div>
                    <div>
                      <div class="text-[1.05rem] font-extrabold tracking-[-0.03em]">
                        Admin Console
                      </div>
                      <div class="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Management Portal
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                    Main Workspace
                  </div>
                  <nav class="grid gap-1">
                    <A
                      href="/admin/home"
                      class={cn(
                        "flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground transition-all duration-300 hover:bg-white/70 hover:text-primary",
                        currentPath() === "/admin" || currentPath() === "/admin/home"
                          ? "translate-x-1 bg-white text-secondary shadow-rail"
                          : "",
                      )}
                    >
                      <span class="material-symbols-outlined text-[20px]">
                        dashboard
                      </span>
                      <span>Console</span>
                    </A>
                    {adminNavItems.map((item) => (
                      <A
                        href={item.href}
                        class={cn(
                          "flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.05em] text-muted-foreground transition-all duration-300 hover:bg-white/70 hover:text-primary",
                          isActive(item.href)
                            ? "translate-x-1 bg-white text-secondary shadow-rail"
                            : "",
                        )}
                      >
                        <span class="material-symbols-outlined text-[20px]">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </A>
                    ))}
                  </nav>
                </div>
              </div>
              <div class="space-y-3 px-2">
                <a
                  href="https://github.com/Stinger911/storywalkers/issues/new"
                  target="blank"
                  class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-primary"
                >
                  <span class="material-symbols-outlined text-[18px]">
                    bug_report
                  </span>
                  <span>Report a bug</span>
                </a>
                <Button
                  variant="outline"
                  class="w-full justify-center rounded-[var(--radius-md)] border-border/60 bg-white/80"
                  onClick={() => {
                    void auth.logout();
                    window.location.href = "/";
                  }}
                >
                  Log out
                </Button>
              </div>
            </aside>
            <div class="min-w-0">{props.children}</div>
          </div>
        </AppShell>
      </div>
    </RequireAuth>
  );
}
