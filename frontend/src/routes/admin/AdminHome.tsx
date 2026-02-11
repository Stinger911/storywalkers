import { A } from "@solidjs/router";
import { Grid, Col } from "../../components/ui/grid";
import { Page } from "../../components/ui/page";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "../../components/ui/breadcrumb";

export function AdminHome() {
  return (
    <Page
      title="Staff workspace"
      subtitle="Manage goals, categories, and step templates."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink current>Admin</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
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
          <A href="/admin/questions" class="panel panel--center hover:shadow-lg">
            <h3 class="text-lg font-semibold">Questions</h3>
            <p class="text-sm text-muted-foreground">
              Answer questions and publish to the library.
            </p>
          </A>
        </Col>
        <Col>
          <A href="/admin/library" class="panel panel--center hover:shadow-lg">
            <h3 class="text-lg font-semibold">Library</h3>
            <p class="text-sm text-muted-foreground">
              Draft and manage knowledge base entries.
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
        <Col>
          <A
            href="/admin/step-completions"
            class="panel panel--center hover:shadow-lg"
          >
            <h3 class="text-lg font-semibold">Step Completions</h3>
            <p class="text-sm text-muted-foreground">
              Review and edit completion notes.
            </p>
          </A>
        </Col>
      </Grid>
    </Page>
  );
}
