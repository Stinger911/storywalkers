import { A } from "@solidjs/router";
import { Grid, Col } from "../../components/ui/grid";

export function AdminHome() {
  return (
    <section class="space-y-6">
      <div class="panel">
        <h2>Staff workspace</h2>
        <p>Manage goals, categories, and step templates.</p>
      </div>

      <Grid cols={2} colsLg={4} class="w-full gap-4">
        <Col>
          <A href="/admin/students" class="panel panel--center hover:shadow-lg">
            <h3 class="text-lg font-semibold">Students</h3>
            <p class="text-sm text-muted-foreground">
              Assign goals and plan steps.
            </p>
          </A>
        </Col>
        <Col>
          <A
            href="/admin/categories"
            class="panel panel--center hover:shadow-lg"
          >
            <h3 class="text-lg font-semibold">Categories</h3>
            <p class="text-sm text-muted-foreground">
              Manage category dictionary.
            </p>
          </A>
        </Col>
        <Col>
          <A href="/admin/goals" class="panel panel--center hover:shadow-lg">
            <h3 class="text-lg font-semibold">Goals</h3>
            <p class="text-sm text-muted-foreground">
              Maintain learning goals.
            </p>
          </A>
        </Col>
        <Col>
          <A
            href="/admin/step-templates"
            class="panel panel--center hover:shadow-lg"
          >
            <h3 class="text-lg font-semibold">Step Templates</h3>
            <p class="text-sm text-muted-foreground">
              Templates for student plans.
            </p>
          </A>
        </Col>
      </Grid>
    </section>
  );
}
