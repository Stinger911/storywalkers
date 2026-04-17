import { A } from "@solidjs/router";
import { Card, CardContent } from "../../components/ui/card";
import { Col, Grid } from "../../components/ui/grid";

type AdminCard = {
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: string;
  image?: string;
  progress?: number[];
};

const adminCards: readonly AdminCard[] = [
  {
    title: "Students",
    description:
      "Assign goals and plan steps for individualized learning paths.",
    cta: "Manage Students",
    href: "/admin/students",
    icon: "group",
  },
  {
    title: "Questions",
    description:
      "Answer submitted questions and publish curated content to the library.",
    cta: "Review Queue",
    href: "/admin/questions",
    icon: "quiz",
  },
  {
    title: "Library",
    description:
      "Draft and manage the master knowledge base entries. Curate the definitive guide for all walkers.",
    cta: "Catalog Archive",
    href: "/admin/library",
    icon: "menu_book",
  },
  {
    title: "Categories",
    description: "Manage the global category dictionary and content hierarchy.",
    cta: "Edit Dictionary",
    href: "/admin/categories",
    icon: "category",
  },
  {
    title: "Goals",
    description: "Maintain learning goals and track aggregate success metrics.",
    cta: "Milestones",
    href: "/admin/goals",
    icon: "flag",
    progress: [1, 1, 0.35, 0.15],
  },
  {
    title: "Courses",
    description: "Manage catalog pricing, enrollment rules, and goal mapping.",
    cta: "Catalog Pricing",
    href: "/admin/courses",
    icon: "school",
  },
  {
    title: "Lesson Completions",
    description: "Review and edit completion notes and verify step approvals.",
    cta: "Verify Notes",
    href: "/admin/step-completions",
    icon: "fact_check",
  },
  {
    title: "Payments",
    description:
      "Monitor payment status, refunds, and user activation records.",
    cta: "Transaction Log",
    href: "/admin/payments",
    icon: "payments",
  },
];

const activityItems = [
  {
    icon: "trending_up",
    accent: "text-[#2a683a]",
    title: "12 New Student Registrations",
    detail: "Growth increased by 14% this week",
  },
  {
    icon: "pending_actions",
    accent: "text-primary",
    title: "45 Questions Awaiting Review",
    detail: "Average response time: 4.2 hours",
  },
] as const;

const statItems = [
  { label: "Total Revenue", value: "$14,204" },
  { label: "Active Walks", value: "892" },
  { label: "Goal Completions", value: "156" },
  { label: "Retention Rate", value: "94%" },
] as const;

export function AdminHome() {
  return (
    <section class="space-y-10 pb-8">
      <header class="space-y-4 lg:space-y-5">
        <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
          Internal Administrator Portal
        </p>
        <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="space-y-1.5">
            <h1 class="text-4xl font-extrabold tracking-[-0.05em] text-foreground sm:text-5xl">
              Admin Console
            </h1>
            <p class="text-lg font-medium text-muted-foreground">
              Staff Workspace • High Priority Actions
            </p>
          </div>
          {/* <ButtonLink href="/admin/library" icon="add">
            Create New Entry
          </ButtonLink> */}
        </div>
      </header>

      <Grid cols={1} colsMd={2} colsLg={4} class="gap-5 lg:gap-6">
        {adminCards.map((card) => (
          <Col
            span={1}
            spanMd={1}
            spanLg={card.image ? 2 : 1}
            class={card.image ? "lg:col-span-2" : ""}
          >
            <Card class="group h-full overflow-hidden rounded-[calc(var(--radius-lg)+4px)] border border-border/20 bg-card shadow-none transition-all duration-300 hover:border-primary/20 hover:shadow-card">
              <CardContent class="flex h-full flex-col justify-between p-0">
                <div
                  class={
                    card.image
                      ? "grid h-full lg:grid-cols-[minmax(0,1fr)_164px]"
                      : "h-full"
                  }
                >
                  <div class="flex h-full flex-col justify-between p-5 sm:p-6">
                    <div>
                      <div class="mb-6 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(237,244,255,0.95)] text-primary transition-transform duration-300 group-hover:scale-105">
                        <span class="material-symbols-outlined text-[22px]">
                          {card.icon}
                        </span>
                      </div>
                      <h2 class="text-[1.85rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2rem] lg:text-[1.9rem]">
                        {card.title}
                      </h2>
                      <p class="mt-2 max-w-[26ch] text-sm leading-8 text-muted-foreground">
                        {card.description}
                      </p>
                    </div>

                    <div class="mt-8 space-y-4">
                      {card.progress ? (
                        <div class="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-[rgba(223,233,247,0.85)]">
                          {card.progress.map((opacity) => (
                            <span
                              class="h-full flex-1 rounded-full bg-[#2a683a]"
                              style={{ opacity: opacity.toString() }}
                            />
                          ))}
                        </div>
                      ) : null}
                      <A
                        href={card.href}
                        class="inline-flex items-center gap-1 text-sm font-bold text-secondary transition-all duration-300 group-hover:gap-2"
                      >
                        <span>{card.cta}</span>
                        <span class="material-symbols-outlined text-[18px]">
                          arrow_forward
                        </span>
                      </A>
                    </div>
                  </div>

                  {card.image ? (
                    <div class="relative hidden overflow-hidden lg:block">
                      <img
                        src={card.image}
                        alt=""
                        class="h-full w-full object-cover opacity-90"
                      />
                      <div class="absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,white_0%,rgba(255,255,255,0)_100%)]" />
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Col>
        ))}
      </Grid>

      <Card class="rounded-[calc(var(--radius-lg)+6px)] border-0 bg-[linear-gradient(135deg,rgba(237,244,255,1)_0%,rgba(223,233,247,0.85)_100%)] shadow-none">
        <CardContent class="p-6 sm:p-8">
          <div class="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-12">
            <div class="flex-1">
              <h2 class="text-2xl font-bold tracking-[-0.03em] text-foreground">
                Workspace Activity
              </h2>
              <div class="mt-6 space-y-6">
                {activityItems.map((item) => (
                  <div class="flex items-start gap-4">
                    <div
                      class={`flex h-10 w-10 items-center justify-center rounded-full bg-white ${item.accent}`}
                    >
                      <span class="material-symbols-outlined text-[18px]">
                        {item.icon}
                      </span>
                    </div>
                    <div>
                      <p class="text-sm font-bold text-foreground">
                        {item.title}
                      </p>
                      <p class="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Grid cols={1} colsSm={2} class="w-full gap-4 lg:w-[46%]">
              {statItems.map((item) => (
                <Card class="rounded-[calc(var(--radius-lg)+2px)] border border-border/20 bg-white shadow-none">
                  <CardContent class="p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p class="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-foreground">
                      {item.value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </Grid>
          </div>
        </CardContent>
      </Card>

      <footer class="flex flex-col gap-4 border-t border-border/30 pt-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© 2024 StoryWalkers Club Management System. All Rights Reserved.</p>
        <div class="flex flex-wrap items-center gap-5">
          <a
            class="font-bold transition-colors duration-300 hover:text-primary"
            href="#"
          >
            System Health
          </a>
          <a
            class="font-bold transition-colors duration-300 hover:text-primary"
            href="#"
          >
            Admin Logs
          </a>
          <a
            class="font-bold transition-colors duration-300 hover:text-primary"
            href="#"
          >
            Security Hub
          </a>
        </div>
      </footer>
    </section>
  );
}

// function ButtonLink(props: {
//   href: string;
//   icon: string;
//   children: string;
// }) {
//   return (
//     <A
//       href={props.href}
//       class="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[linear-gradient(135deg,#2f5f8d_0%,#4a78a7_100%)] px-5 py-3 text-sm font-bold text-white shadow-card transition-all duration-300 hover:opacity-95 active:scale-[0.98]"
//     >
//       <span class="material-symbols-outlined text-[18px]">{props.icon}</span>
//       <span>{props.children}</span>
//     </A>
//   );
// }
