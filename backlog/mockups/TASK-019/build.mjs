import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '../../../frontend/node_modules/vite/dist/node/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, '../../../frontend')
const clients = resolve(frontend, 'src/features/clients')
function sliceAt(source, from, to) {
  const start = source.indexOf(from)
  const end = source.indexOf(to, start + from.length)
  if (start < 0 || end < 0) throw new Error('Проверьте границы прототипа: ' + from)
  return source.slice(start, end)
}
const [bundle] = await build({
  configFile: false, root: frontend, publicDir: false, logLevel: 'error',
  resolve: { dedupe: ['react','react-dom','@mantine/core','@mantine/form','@mantine/hooks','@mantine/notifications','@tabler/icons-react','@fontsource/onest'] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [{
    name: 'offline-profile-layout', enforce: 'pre',
    transform(source, id) {
      if (id === resolve(clients, 'ClientOverviewSection.tsx')) {
        return source.replace(sliceAt(source, '<Group gap="sm" wrap="nowrap"', '{!canManage'), '')
      }
      if (id === resolve(clients, 'ClientForm.tsx')) {
        const groupPicker = sliceAt(source, '<MultiSelect', '            <TextInput')
        return source.replace(groupPicker, '').replace('loading={submitting}', 'disabled={!form.isDirty()} loading={submitting}')
          .replace('type="date"', `type="date" description={form.values.birthDate && getClientAgeDisplayValue(form.values.birthDate, '2026-11-21')}`)
          .replace("import type { ReactNode }", "import { getClientAgeDisplayValue } from './clientBirthDate'\nimport type { ReactNode }")
      }
      const panel = ['MembershipCorrectionPanel', 'MembershipPurchasePanel', 'MembershipRenewPanel']
        .find(name => id === resolve(clients, 'membership', name + '.tsx'))
      if (panel) {
        const marker = panel === 'MembershipCorrectionPanel' ? '  const formRef' : '  const selected ='
        if (!source.includes(marker)) throw Error('Проверьте форму ' + panel)
        const withDirty = source.replace(marker, "  useDraftState('memberships', form.isDirty())\n" + marker)
        const module = 'import { useDraftState } from ' + JSON.stringify(resolve(here, 'DraftState.tsx')) + '\n'
        if (panel !== 'MembershipCorrectionPanel') return module + withDirty
        const title = sliceAt(withDirty, '<Group justify="space-between" wrap="wrap">', '          <SimpleGrid')
        const saleFacts = sliceAt(withDirty, '<InfoItem', '            <PaymentDateInput')
        return module + withDirty.replace(title,
          '<div><Text fw={700}>{currentMembership.membershipName}</Text><Text c="dimmed" size="sm">{formatCurrencyValue(currentMembership.grossAmount)} · Куплен {formatDateValue(currentMembership.purchaseDate)}</Text></div>\n')
          .replace(saleFacts, '').replace('<Button loading={pending} type="submit">', '<Button disabled={!form.isDirty()} loading={pending} type="submit">')
      }
      if (id !== resolve(clients, 'ClientDetailScreen.tsx')) return
      // The inline editor supplies its own success and error feedback next to the form.
      const feedback = sliceAt(source, '      const feedback =', '    } catch')
      const actionFailure = sliceAt(source.slice(source.indexOf(feedback) + feedback.length), '      setActionError(', '      throw error')
      const all = sliceAt(source, '<ClientOverviewSection', '        </>')
      const edit = sliceAt(source, '      {canManage && client ? (\n        <Button\n          leftSection={<IconEdit', '      {canManage && client ? (\n        <Button\n          leftSection={<IconGitBranch')
      const backButton = sliceAt(source, '<Button\n        leftSection={<IconArrowLeft', '    </Group>')
      return 'import { DetailPrototype } from ' + JSON.stringify(resolve(here, 'DetailPrototype.tsx')) + '\n' +
        source.replace(feedback, '').replace(actionFailure, '').replace(edit, '').replace(backButton, '{!client && (' + backButton.trim() + ')}\n')
          .replace(all, `<DetailPrototype client={client} canManage={canManage} onBack={onBack} backLabel={backLabel}
            actions={profileActions} onPhotoUpload={handlePhotoUpload} photoVersion={photoVersion}
            pending={actionPending} onClientChange={setClient} onSubmit={handleMembershipAction}
            onMembershipCommentChange={handleMembershipCommentChange} />\n`)
    },
  }],
  build: { write: false, license: {fileName: 'licenses.txt'},
    lib: {entry: resolve(here, 'preview.tsx'), formats: ['iife'], name: 'ClientTabsPreview'} },
})
const script = bundle.output.find(item => item.type === 'chunk').code.replace(/<\/script/gi, '<\\/script').replace(/^[ \t]+$/gm, '')
const css = bundle.output.find(item => item.fileName.endsWith('.css')).source
const licenses = [bundle.output.find(item => item.fileName === 'licenses.txt').source,
  await readFile(resolve(frontend, 'node_modules/@fontsource/onest/LICENSE'), 'utf8')]
await writeFile(resolve(here, 'preview.html'), '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Карточка клиента · TASK-019</title><style>' + css +
  '</style></head><body class="app-shell"><div id="root"></div><script type="application/json" id="licenses">' + JSON.stringify(licenses).replaceAll('<','\\u003c') + '</script><script>' + script + '</script></body></html>')
