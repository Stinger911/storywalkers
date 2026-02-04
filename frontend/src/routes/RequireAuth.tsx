import { Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { Navigate } from '@solidjs/router'
import { Loading } from '../components/Loading'
import { useAuth } from '../lib/auth'

type RequireAuthProps = {
  role?: 'student' | 'staff'
  children: JSX.Element
}

export function RequireAuth(props: RequireAuthProps) {
  const auth = useAuth()
  return (
    <Show when={!auth.loading()} fallback={<div class="page"><Loading /></div>}>
      {(() => {
        const me = auth.me()
        if (!me) {
          return <Navigate href="/login" />
        }
        if (props.role && me.role !== props.role) {
          return <Navigate href={me.role === 'staff' ? '/admin' : '/student'} />
        }
        return props.children
      })()}
    </Show>
  )
}
