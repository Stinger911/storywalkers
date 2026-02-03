import { createEffect } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useAuth } from '../lib/auth'
import { Loading } from '../components/Loading'

export function Landing() {
  const auth = useAuth()
  const navigate = useNavigate()

  createEffect(() => {
    if (auth.loading()) return
    const me = auth.me()
    if (!me) {
      navigate('/login', { replace: true })
      return
    }
    navigate(me.role === 'staff' ? '/admin' : '/student', { replace: true })
  })

  return (
    <div class="page">
      <Loading />
    </div>
  )
}
