import { A } from '@solidjs/router'
import { useAuth } from '../../lib/auth'

export function AdminHome() {
  const auth = useAuth()

  return (
    <section class="space-y-6">
      <div class="panel">
        <h2>Staff workspace</h2>
        <p>Manage goals, categories, and step templates.</p>
        <div class="panel__meta">
          <span>Signed in as</span>
          <strong>{auth.me()?.displayName ?? auth.me()?.email ?? 'Staff'}</strong>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <A href="/admin/students" class="panel panel--center hover:shadow-lg">
          <h3 class="text-lg font-semibold">Students</h3>
          <p class="text-sm text-muted-foreground">Assign goals and plan steps.</p>
        </A>
        <A href="/admin/categories" class="panel panel--center hover:shadow-lg">
          <h3 class="text-lg font-semibold">Categories</h3>
          <p class="text-sm text-muted-foreground">Manage category dictionary.</p>
        </A>
        <A href="/admin/goals" class="panel panel--center hover:shadow-lg">
          <h3 class="text-lg font-semibold">Goals</h3>
          <p class="text-sm text-muted-foreground">Maintain learning goals.</p>
        </A>
        <A href="/admin/step-templates" class="panel panel--center hover:shadow-lg">
          <h3 class="text-lg font-semibold">Step Templates</h3>
          <p class="text-sm text-muted-foreground">Templates for student plans.</p>
        </A>
      </div>
    </section>
  )
}
