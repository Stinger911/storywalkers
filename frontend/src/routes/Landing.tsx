import { createEffect } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useAuth } from '../lib/auth'
import { Loading } from '../components/Loading'
import { DEFAULT_GOAL_SLUG, readDraft, startPath, writeDraft } from './start/startDraft'

export function Landing() {
  const auth = useAuth()
  const navigate = useNavigate()

  createEffect(() => {
    if (auth.loading()) return
    const me = auth.me()
    if (!me) {
      // The landing page picks the goal (beta: YouTube only) and hands the
      // visitor to the pre-registration funnel.
      const goal = new URL(window.location.href).searchParams.get('goal')
      const goalSlug = goal?.trim().toLowerCase() || DEFAULT_GOAL_SLUG
      const draft = readDraft()
      if (draft.goalSlug !== goalSlug) {
        writeDraft({ goalSlug })
      }
      navigate(startPath('channel'), { replace: true })
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
