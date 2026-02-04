import { createSignal } from 'solid-js'
import { Button } from '../../components/ui/button'
import { StudentHome } from './StudentHome'
import { StudentQuestions } from './StudentQuestions'

const tabs = [
  { id: 'path', label: 'My Path' },
  { id: 'questions', label: 'My Questions' },
] as const

type TabId = (typeof tabs)[number]['id']

export function StudentProfile() {
  const [activeTab, setActiveTab] = createSignal<TabId>('path')

  return (
    <section class="space-y-6">
      <div class="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            variant={activeTab() === tab.id ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab() === 'path' ? <StudentHome /> : <StudentQuestions />}
    </section>
  )
}
