import { branches, fixture, groups } from '../../done/2026-11-21/TASK-018-mockups/fixtures'

export const demoGroups = [...groups, {
  ...groups[0], id: 'kick-morning', name: 'Кикбоксинг · утренняя группа', trainingStartTime: '09:00', weekdays: [1, 3, 5],
}]
export const examples = { standard: 'Администратор', coach: 'Тренер', empty: 'Новый клиент', multi: 'Два абонемента', error: 'Сбой сохранения', long: 'Длинное ФИО' }
export type Example = keyof typeof examples

export function makeClient(example: Example) {
  const form = fixture(example === 'long' ? 'long' : 'photo')
  const group = groups[0]
  const sale = {
    id: 'membership-1', saleId: 'sale-1', membershipCatalogItemId: 'month', membershipName: 'Месяц · основная группа',
    behaviorKind: 'Term', purchaseDate: '2026-11-01', paymentDate: '2026-11-01', expirationDate: '2026-11-30',
    pricingMode: 'Catalog', grossAmount: 6000, catalogPrice: 6000, entitlementState: 'Active', coverageKind: 'TargetGroups',
    targetGroups: [{ groupId: group.id, groupName: group.name, branchId: group.branchId, branchName: group.branchName, position: 0, isActive: true }],
    paymentRecordedAt: '2026-11-01T10:00:00Z', paymentRecordedByUserName: 'Мария Орлова', validFrom: '2026-11-01',
    changeReason: 'Purchase', comment: null,
  }
  if (example === 'multi') sale.membershipName = 'Основная группа · ноябрь'
  const history = [
    { id: '1', trainingDate: '2026-11-19', groupName: group.name, groupId: group.id, isPresent: true },
    { id: '2', trainingDate: '2026-11-17', groupName: group.name, groupId: group.id, isPresent: false },
  ]
  const sales = example === 'coach' || example === 'empty' ? [] : [sale]
  if (example === 'multi') sales.push({ ...sale, id: 'membership-2', saleId: 'sale-2', membershipName: 'Утренняя группа · ноябрь',
    targetGroups: [{ ...sale.targetGroups[0], groupId: 'kick-morning', groupName: demoGroups[2].name }] })
  return { ...form, id: 'preview-client', fullName: [form.lastName,form.firstName,form.middleName].join(' '),
    groupIds: example === 'empty' ? [] : [group.id], groups: example === 'empty' ? [] : [group], branchName: group.branchName, status: 'Active', businessDate: '2026-11-21',
    contacts: example === 'empty' || example === 'coach' ? [] : [{ id: 'contact', type: 'Мама', fullName: 'Марина Алексеева', phone: '+7 900 000-03-18' }],
    isProfessional: false, photo: null, currentMemberships: sales, membershipHistory: [...sales],
    hasCurrentMembership: sales.length > 0, hasActiveMembership: sales.length > 0,
    attendanceHistory: example === 'empty' ? [] : history,
    notes: example === 'empty' ? '' : form.notes, notesLastChangedByName: 'Мария Орлова', notesLastChangedAt: '2026-11-20T12:34:00Z',
  }
}

export function installFixtures(example: Example) {
  const client = makeClient(example)
  let serial = client.currentMemberships.length
  const saleTemplate = makeClient('standard').currentMemberships[0]
  let failEdit = example === 'error'
  // This offline review only handles the endpoints needed to inspect and edit the example client.
  window.fetch = async (input, init) => {
    const url = new URL(String(input), 'https://preview.invalid')
    const path = url.pathname.replace(/^\/api/, '')
    const method = init?.method ?? 'GET'
    if (path === '/clients/preview-client' && method === 'GET') return Response.json(client)
    if (path === '/clients/preview-client' && method === 'PUT') {
      if (failEdit) {
        failEdit = false
        return Response.json({ detail: 'Не удалось сохранить изменения. Повторите сохранение.' }, { status: 503 })
      }
      const formNoteAtSave = client.notes
      const payload = JSON.parse(String(init?.body))
      Object.assign(client, { firstName: '', lastName: '', middleName: '', ...payload })
      if (payload.notes !== undefined && payload.notes !== '' && payload.notes !== formNoteAtSave) {
        client.notesLastChangedByName = 'Администратор'
        client.notesLastChangedAt = '2026-11-21T09:15:00Z'
      }
      client.groups = demoGroups.filter(group => client.groupIds.includes(group.id))
      client.fullName = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ')
      return Response.json(client)
    }
    if (path.startsWith('/clients/preview-client/membership/') && method === 'POST' &&
        ['correct', 'purchase', 'renew'].includes(path.split('/').at(-1) ?? '')) {
      if (failEdit) {
        failEdit = false
        return Response.json({ detail: 'Не удалось сохранить абонемент. Повторите сохранение.' }, { status: 503 })
      }
      const input = JSON.parse(String(init?.body))
      const previous = client.currentMemberships.find(sale => sale.id === input.ExpectedMembershipId)
      const correct = path.endsWith('/correct')
      const versionId = 'preview-version-' + ++serial
      const item = { ...(previous ?? saleTemplate), id: versionId,
        saleId: correct && previous ? previous.saleId : 'preview-sale-' + serial,
        paymentDate: input.PaymentDate, validFrom: input.ValidFrom ?? input.PaymentDate,
        purchaseDate: correct && previous ? previous.purchaseDate : input.PaymentDate,
        expirationDate: input.ValidTo ?? '2026-12-20', changeReason: correct ? 'Correction' : 'Purchase',
        targetGroups: input.TargetGroupIds.map((id: string, position: number) => {
          const group = demoGroups.find(group => group.id === id)!
          return { groupId: id, groupName: group.name, branchId: group.branchId, branchName: group.branchName, position, isActive: group.isActive }
        }),
      }
      if (!correct) {
        item.grossAmount = input.ManualSaleAmount ?? 6000
        item.pricingMode = input.MembershipCatalogItemId ? (input.ManualSaleAmount == null ? 'Catalog' : 'CatalogOverride') : 'AmountOnly'
        item.membershipName = input.MembershipCatalogItemId ? 'Месяц' : 'Без варианта каталога'
      }
      client.currentMemberships = [item, ...client.currentMemberships.filter(sale => sale.id !== previous?.id)]
      client.membershipHistory = [item, ...client.membershipHistory]
      client.hasCurrentMembership = true
      client.hasActiveMembership = true
      return Response.json(client)
    }
    if (path.endsWith('/expiration-suggestion')) {
      const startDate = url.searchParams.get('startDate')
      const suggestions: Record<string, string> = { '2026-11-01': '2026-11-30', '2026-11-02': '2026-12-01', '2026-11-21': '2026-12-20' }
      if (startDate && suggestions[startDate]) return Response.json({ startDate, expirationDate: suggestions[startDate], behaviorKind: 'Term' })
      return Response.json({ detail: 'Для этой даты в примере задайте окончание вручную.' }, {status: 422})
    }
    if (path === '/groups') return Response.json({ items: demoGroups, totalCount: demoGroups.length, skip: 0, take: 100 })
    if (path.endsWith('/branches')) return Response.json(branches)
    if (path.endsWith('/eligible')) return Response.json([{ id: 'month', name: 'Месяц', behaviorKind: 'Term', price: 6000,
      branchId: 'north', availableFrom: '2026-01-01', availableTo: null, isSystemOwned: false }])
    if (path.endsWith('/messenger/telegram')) return Response.json({
      clientId: client.id, capabilities: { visible: example !== 'coach', canRead: true, canCreateLink: true },
      connection: { status: 'NotConnected' }, totalMessageCount: 0,
    })
    if (path.endsWith('/messages')) return Response.json({ items: [], totalCount: 0 })
    if (path.endsWith('/read')) return Response.json({})
    return Response.json({ detail: 'Эта операция доступна в рабочей CRM. Прототип показывает расположение и форму.' }, {status: 422})
  }
  return client
}
