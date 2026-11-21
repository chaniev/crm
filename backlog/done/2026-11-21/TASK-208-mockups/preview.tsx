import { createRoot } from 'react-dom/client'
import { MantineProvider, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import '@fontsource/onest/cyrillic-400.css'
import '@fontsource/onest/cyrillic-600.css'
import '@fontsource/onest/cyrillic-700.css'
import '@fontsource/onest/latin-400.css'
import '@fontsource/onest/latin-600.css'
import '@fontsource/onest/latin-700.css'
import '@mantine/core/styles.css'
import '../../../../frontend/src/index.css'
import '../../../../frontend/src/App.css'
import './preview.css'
import { AuditLogScreen } from '../../../../frontend/src/features/audit/AuditLogScreen'
import { defaultGreenProfile } from '../../../../frontend/src/theme/profiles'
import { createGymCrmTheme, createSemanticVariables } from '../../../../frontend/src/theme'
import { user } from './fixtures'

for (const [name, value] of Object.entries(createSemanticVariables(defaultGreenProfile))) {
  document.documentElement.style.setProperty(name, value)
}
function Preview() {
  const mobile = useMediaQuery('(max-width: 48em)')
  return <MantineProvider theme={createGymCrmTheme(defaultGreenProfile, { mobile })} forceColorScheme="light">
    <main className="review-page">
      <Title order={1}>Журнал действий</Title>
      <AuditLogScreen user={user} onRefreshSession={async () => ({
        isAuthenticated: true, csrfToken: '', bootstrapMode: false, user,
      })} />
    </main>
  </MantineProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
