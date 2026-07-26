import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/onest/700.css'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import {
  ConfigThemeBootstrap,
} from './bootstrap/ConfigThemeBootstrap.tsx'
import { createConfigThemeBootstrapResource } from './bootstrap/configThemeResource.ts'

const configThemeResource = createConfigThemeBootstrapResource()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigThemeBootstrap resource={configThemeResource} />
  </StrictMode>,
)
