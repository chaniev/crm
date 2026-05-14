import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/onest/700.css'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import App from './App.tsx'
import './index.css'
import {
  APP_NOTIFICATION_AUTO_CLOSE_MS,
  APP_NOTIFICATION_LIMIT,
} from './features/shared/notifications.ts'
import { gymCrmTheme } from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light" theme={gymCrmTheme}>
      <Notifications
        autoClose={APP_NOTIFICATION_AUTO_CLOSE_MS}
        limit={APP_NOTIFICATION_LIMIT}
        position="top-right"
      />
      <App />
    </MantineProvider>
  </StrictMode>,
)
