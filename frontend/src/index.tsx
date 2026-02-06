/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth.tsx'
import { I18nProvider } from './lib/i18n.tsx'

const root = document.getElementById('root')

render(
  () => (
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  ),
  root!,
)
