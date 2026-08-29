import { MantineProvider } from '@mantine/core'
import type { CSSProperties } from 'react'
import { createGymCrmTheme } from '../theme/createGymCrmTheme'
import {
  createFoundationVariables,
  foundationBreakpoints,
  foundationElevation,
  foundationLayers,
  foundationRadii,
  foundationSpacing,
} from '../theme/foundations'
import { themeProfiles } from '../theme/profiles'
import { semanticToneDefinitions } from '../theme/semanticTones'
import { createSemanticVariables } from '../theme/semanticVariables'
import { typographyRoles } from '../theme/typography'
import { SharedComponentsCatalog } from './SharedComponentsCatalog'
import {
  catalogContentModes,
  catalogMotionModes,
  catalogViewportModes,
  createCatalogSearch,
  readCatalogControls,
} from './controls'

type CatalogAppProps = {
  search?: string
}

const viewportWidths: Record<string, string> = {
  fluid: '100%',
  '360': foundationBreakpoints.narrowMax,
  '390': '390px',
  '420': '420px',
  '440': '440px',
  '768': '768px',
  '1440': '1440px',
}

const longFixture =
  'Очень длинное название филиала «Северный спортивный центр имени команды чемпионов» — проверка переноса русского содержимого.'

function RegistryList({
  registry,
}: {
  registry: Record<string, string>
}) {
  return (
    <dl className="catalog-registry">
      {Object.entries(registry).map(([name, value]) => (
        <div className="catalog-registry__row" key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function typographyVariable(role: keyof typeof typographyRoles, suffix: string) {
  const roleName = role.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
  return `var(--crm-type-${roleName}-${suffix})`
}

export function CatalogApp({ search = window.location.search }: CatalogAppProps) {
  const profileIds = themeProfiles.map((profile) => profile.id)
  const controls = readCatalogControls(search, profileIds, themeProfiles[0].id)
  const profile = themeProfiles.find(({ id }) => id === controls.theme) ?? themeProfiles[0]
  const theme = createGymCrmTheme(profile)
  const catalogStyle = {
    ...createSemanticVariables(profile),
    ...createFoundationVariables(),
  } as CSSProperties
  const previewStyle = { maxWidth: viewportWidths[controls.viewport] }

  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <main className="catalog-page" style={catalogStyle}>
        <header className="catalog-header">
          <div>
            <h1>Каталог дизайн-системы</h1>
            <p>Production foundations, recipes and audited shared component contracts.</p>
          </div>
          <span>Docs: frontend/src/catalog/README.md</span>
        </header>

        <form action="/catalog.html" className="catalog-controls" method="get">
          <label>
            Theme
            <select defaultValue={controls.theme} name="theme">
              {profileIds.map((id) => <option key={id}>{id}</option>)}
            </select>
          </label>
          <label>
            Viewport
            <select defaultValue={controls.viewport} name="viewport">
              {catalogViewportModes.map((mode) => <option key={mode}>{mode}</option>)}
            </select>
          </label>
          <label>
            Motion
            <select defaultValue={controls.motion} name="motion">
              {catalogMotionModes.map((mode) => <option key={mode}>{mode}</option>)}
            </select>
          </label>
          <label>
            Content
            <select defaultValue={controls.content} name="content">
              {catalogContentModes.map((mode) => <option key={mode}>{mode}</option>)}
            </select>
          </label>
          <button type="submit">Открыть состояние</button>
        </form>

        <div
          className="catalog-preview"
          data-content={controls.content}
          data-crm-responsive-typography
          data-motion={controls.motion}
          data-testid="catalog-preview"
          data-theme={controls.theme}
          data-viewport={controls.viewport}
          style={previewStyle}
        >
          <p className="catalog-preview__fixture">
            {controls.content === 'long' ? longFixture : 'Стандартный пример содержимого'}
          </p>

          <nav aria-label="Theme profile review links" className="catalog-theme-links">
            {themeProfiles.map(({ id }) => (
              <a
                aria-current={id === controls.theme ? 'page' : undefined}
                href={createCatalogSearch({ ...controls, theme: id })}
                key={id}
              >
                {id}
              </a>
            ))}
          </nav>

          <section aria-label="Foundation registries" className="catalog-section">
            <h2>Foundation registries</h2>
            <p>
              Импортируются из production-модулей темы; локальные копии токенов отсутствуют.
            </p>
            <h3>Spacing</h3>
            <RegistryList registry={foundationSpacing} />
            <h3>Mobile list rhythm</h3>
            <p>
              8px (<code>--crm-space-2</code>) внутри группы, 12px (
              <code>--crm-space-3</code>) между строками и 16–24px (
              <code>--crm-space-4</code>…<code>--crm-space-6</code>) между секциями.
            </p>
            <h3>Radii</h3>
            <RegistryList registry={foundationRadii} />
            <h3>Elevation</h3>
            <RegistryList registry={foundationElevation} />
            <h3>Layers</h3>
            <RegistryList registry={foundationLayers} />
            <h3>Breakpoints</h3>
            <RegistryList registry={foundationBreakpoints} />
            <h3>Semantic tones</h3>
            <RegistryList registry={Object.fromEntries(
              Object.entries(semanticToneDefinitions).map(([tone, definition]) => [
                tone,
                definition.foreground,
              ]),
            )} />
            <h3>Typography</h3>
            <div className="catalog-type-scale">
              {(Object.keys(typographyRoles) as Array<keyof typeof typographyRoles>).map((role) => (
                <div
                  className="catalog-type-role"
                  data-catalog-type-role={role}
                  key={role}
                  style={{
                    fontFamily: typographyVariable(role, 'family'),
                    fontSize: typographyVariable(role, 'size'),
                    fontWeight: typographyVariable(role, 'weight'),
                    letterSpacing: typographyVariable(role, 'letter-spacing'),
                    lineHeight: typographyVariable(role, 'line-height'),
                  }}
                >
                  <span>{role}</span>
                  <span>Съешь ещё этих мягких французских булок · 0123456789</span>
                </div>
              ))}
            </div>
          </section>

          <SharedComponentsCatalog longContent={controls.content === 'long'} />
        </div>
      </main>
    </MantineProvider>
  )
}
