import { A } from "@solidjs/router";
import { Card, CardContent, CardTitle } from "../../components/ui/card";
import { Illustration } from "../../components/ui/illustration";
import { RailCard } from "../../components/ui/rail-card";
import { StudentHome } from "./StudentHome";
import { StudentPlanProvider } from "./studentPlanContext";

export function StudentProfile() {
  return (
    <section class="space-y-6">
      <StudentPlanProvider>
        <StudentHome />
      </StudentPlanProvider>
    </section>
  );
}

export function StudentProfileRail() {
  return (
    <>
      <Card class="border border-border/70">
        <CardTitle class="p-3">
          <Illustration
            src="/illustrations/rail-hero.png"
            alt="Learning illustration"
            class="h-36 w-full rounded-[var(--radius-lg)] no-border"
          />
        </CardTitle>
        <CardContent class="flex flex-col gap-3 p-3">
          <RailCard title="My Questions">
            <div class="space-y-2 text-sm">
              <A
                href="/student/questions"
                class="flex items-center justify-between text-primary"
              >
                <span>My Questions</span>
                <span class="text-xs text-muted-foreground">New</span>
              </A>
              <A
                href="/student/questions"
                class="flex items-center justify-between text-primary"
              >
                <span>Ask Question</span>
                <span class="text-xs text-muted-foreground">+</span>
              </A>
            </div>
          </RailCard>

          <RailCard title="Library">
            <div class="space-y-2 text-sm">
              <A
                href="/student/library"
                class="flex items-center justify-between text-primary"
              >
                <span>Library</span>
                <span class="text-xs text-muted-foreground">Recent</span>
              </A>
              <A
                href="/student/library"
                class="flex items-center justify-between text-primary"
              >
                <span>Saved</span>
                <span class="text-xs text-muted-foreground">0</span>
              </A>
            </div>
          </RailCard>

          <div class="grid grid-cols-2 gap-3">
            <A
              href="/student/questions"
              class="group rounded-[var(--radius-md)] border border-border/70 bg-card p-2 shadow-rail"
            >
              <Illustration
                src="/illustrations/tile-questions.svg"
                alt="Questions"
                class="h-20 w-full"
              />
              <div class="mt-2 text-xs font-semibold text-foreground group-hover:text-primary">
                My Questions
              </div>
            </A>
            <A
              href="/student/library"
              class="group rounded-[var(--radius-md)] border border-border/70 bg-card p-2 shadow-rail"
            >
              <Illustration
                src="/illustrations/tile-library.svg"
                alt="Library"
                class="h-20 w-full"
              />
              <div class="mt-2 text-xs font-semibold text-foreground group-hover:text-primary">
                Library
              </div>
            </A>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
