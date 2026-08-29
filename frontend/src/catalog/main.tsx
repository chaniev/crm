import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/onest/700.css'
import '@mantine/core/styles.css'
import './catalog.css'
import { CatalogApp } from './CatalogApp'

const CATALOG_ENTRY_MARKER = 'gym-crm-design-system-catalog-entry'
document.documentElement.dataset.catalogEntry = CATALOG_ENTRY_MARKER

createRoot(document.getElementById('catalog-root')!).render(
  <StrictMode>
    <CatalogApp />
  </StrictMode>,
)
