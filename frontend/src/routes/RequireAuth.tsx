import { Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { Navigate, useLocation } from '@solidjs/router'
import { Loading } from '../components/Loading'
import { useAuth } from '../lib/auth'
import { resolveGuardRedirect } from '../lib/routeAccess'

type RequireAuthProps = {
  role?: 'student' | 'staff'
  children: JSX.Element
}

export function RequireAuth(props: RequireAuthProps) {
  const auth = useAuth()
  const location = useLocation()
  return (
    <Show when={!auth.loading()} fallback={<div class="page"><Loading /></div>}>
      {(() => {
        const redirect = resolveGuardRedirect({
          me: auth.me(),
          requiredRole: props.role,
          pathname: location.pathname,
        })
        if (redirect) {
          return <Navigate href={redirect} />
        }
        return props.children
      })()}
    </Show>
  )
}
