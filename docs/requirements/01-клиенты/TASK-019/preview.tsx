import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, MantineProvider, NativeSelect, Title } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { useMediaQuery } from '@mantine/hooks'
import { ClientDetailScreen } from '../../../../frontend/src/features/clients/ClientDetailScreen'
import { defaultGreenProfile } from '../../../../frontend/src/theme/profiles'
import { createGymCrmTheme, createSemanticVariables } from '../../../../frontend/src/theme'
import { examples, installFixtures, type Example } from './fixtures'
import { ChatTabAccess } from './ProfileTabs'
import '@fontsource/onest/cyrillic-400.css'
import '@fontsource/onest/cyrillic-600.css'
import '@fontsource/onest/cyrillic-700.css'
import '@fontsource/onest/latin-400.css'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '../../../../frontend/src/index.css'
import '../../../../frontend/src/App.css'
import './preview.css'

for (const [key, value] of Object.entries(createSemanticVariables(defaultGreenProfile))) {
  document.documentElement.style.setProperty(key, value)
}
const requested = new URLSearchParams(location.search).get('example') ?? ''
const example: Example = Object.hasOwn(examples, requested) ? requested as Example : 'standard'
const demoClient = installFixtures(example)
function Preview() {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [screen, go] = useState<'list'|'card'>('card')
  function openCard() {
    history.replaceState(null, '', '#info')
    go('card')
  }
  return <MantineProvider theme={createGymCrmTheme(defaultGreenProfile, {mobile})} forceColorScheme="light">
    <Notifications/>
    <main className="review">
      {screen === 'card' && <ChatTabAccess.Provider value={demoClient.messengerCapabilities.visible}>
        <ClientDetailScreen clientId="preview-client" canManage={example !== 'coach'}
          onBack={() => go('list')} onEdit={() => go('card')}/>
      </ChatTabAccess.Provider>}
      {screen === 'list' && <><Title order={1}>Клиенты</Title><Button mt="md" onClick={openCard}>{demoClient.fullName}</Button></>}
      <details className="review-options"><summary>Примеры для проверки</summary>
        <NativeSelect label="Сценарий" value={example} data={Object.entries(examples).map(([value,label]) => ({value,label}))}
          onChange={event => {const url = new URL(location.href); url.searchParams.set('example', event.target.value); url.hash = ''; location.assign(url.href)}}/>
      </details>
    </main>
  </MantineProvider>
}
createRoot(document.getElementById('root')!).render(<Preview/>)
