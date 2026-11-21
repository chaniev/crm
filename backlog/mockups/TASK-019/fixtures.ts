import { branches, fixture, groups } from '../../done/2026-11-21/TASK-018-mockups/fixtures'

export const examples = { standard: 'Администратор', coach: 'Тренер', empty: 'Новый клиент', error: 'Сбой сохранения', long: 'Длинное ФИО' }
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
  const history = [
    { id: '1', trainingDate: '2026-11-19', groupName: group.name, groupId: group.id, isPresent: true },
    { id: '2', trainingDate: '2026-11-17', groupName: group.name, groupId: group.id, isPresent: false },
  ]
  const sales = example === 'coach' || example === 'empty' ? [] : [sale]
  return { ...form, id: 'preview-client', fullName: [form.lastName,form.firstName,form.middleName].join(' '),
    groups: example === 'empty' ? [] : [group], branchName: group.branchName, status: 'Active', businessDate: '2026-11-21',
    contacts: example === 'empty' || example === 'coach' ? [] : [{ id: 'contact', type: 'Мама', fullName: 'Марина Алексеева', phone: '+7 900 000-03-18' }],
    isProfessional: false, photo: null, currentMemberships: sales, membershipHistory: sales,
    hasCurrentMembership: sales.length > 0, hasActiveMembership: sales.length > 0,
    attendanceHistory: example === 'empty' ? [] : history,
    notes: example === 'empty' ? '' : form.notes, notesLastChangedByName: 'Мария Орлова', notesLastChangedAt: '2026-11-20T12:34:00Z',
  }
}

export function installFixtures(example: Example) {
  const client = makeClient(example)
  let failEdit = example === 'error'
  // This offline review only handles the endpoints needed to inspect the card and edit a note.
  window.fetch = async (input, init) => {
    const path = new URL(String(input), 'https://preview.invalid').pathname.replace(/^\/api/, '')
    const method = init?.method ?? 'GET'
    if (path === '/clients/preview-client' && method === 'GET') return Response.json(client)
    if (path === '/clients/preview-client' && method === 'PUT') {
      if (failEdit) {
        failEdit = false
        return Response.json({ detail: 'Не удалось сохранить изменения. Повторите сохранение.' }, { status: 503 })
      }
      Object.assign(client, JSON.parse(String(init?.body)))
      client.fullName = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ')
      return Response.json(client)
    }
    if (path === '/groups') return Response.json({ items: groups, totalCount: groups.length, skip: 0, take: 100 })
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
}
