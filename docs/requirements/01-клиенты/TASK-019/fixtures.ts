import { branches, demoPhoto, fixture, groups } from '../TASK-018/fixtures'
import type { ClientMessengerMessage } from '../../../../frontend/src/lib/api'
import demoQr from './demo-telegram-qr.svg?raw'

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
    telegramContactUsername: example === 'empty' || example === 'coach' ? null : '@alexey_example',
    messengerCapabilities: {
      visible: example !== 'coach', canRead: example !== 'coach', canReply: example !== 'coach',
      canCreateLink: example !== 'coach', canShowQr: example !== 'coach',
    },
    groupIds: example === 'empty' ? [] : [group.id], groups: example === 'empty' ? [] : [group], branchName: group.branchName, status: 'Active', businessDate: '2026-11-21',
    contacts: example === 'empty' || example === 'coach' ? [] : [{ id: 'contact', type: 'Мама', fullName: 'Марина Алексеева', phone: '+7 900 000-03-18' }],
    isProfessional: false, photo: example === 'standard' ? { path: demoPhoto, contentType: 'image/jpeg' } : null, currentMemberships: sales, membershipHistory: [...sales],
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
  let failReply = example === 'error'
  const connected = example !== 'empty' && client.messengerCapabilities.visible
  let pendingLinkExpiresAt: string | null = null
  const messages: Partial<ClientMessengerMessage>[] = connected ? [{
    id: 'demo-inbound', direction: 'Inbound', status: 'Received', telegramDisplayName: client.fullName,
    text: 'Добрый день! Подскажите, тренировка сегодня в обычное время?', createdAt: '2026-11-21T08:30:00Z',
  }] : []
  // This offline review only handles the endpoints needed to inspect and edit the example client.
  window.fetch = async (input, init) => {
    const url = new URL(String(input), 'https://preview.invalid')
    const path = url.pathname.replace(/^\/api/, '')
    const method = init?.method ?? 'GET'
    if (path === '/clients/preview-client' && method === 'GET') return Response.json(client)
    if (path === '/clients/preview-client/photo' && method === 'POST') {
      const file = (init?.body as FormData).get('photo')
      if (!(file instanceof File)) return Response.json({ detail: 'Выберите фотографию.' }, { status: 422 })
      const src = URL.createObjectURL(file)
      const image = new Image()
      image.src = src
      try {
        await image.decode()
      } catch {
        URL.revokeObjectURL(src)
        return Response.json({ detail: 'Не удалось прочитать файл. Выберите другое изображение.' }, { status: 422 })
      }
      if (client.photo?.path.startsWith('blob:')) URL.revokeObjectURL(client.photo.path)
      client.photo = { path: src, contentType: file.type }
      return Response.json({})
    }
    if (path === '/clients/preview-client' && method === 'PUT') {
      if (failEdit) {
        failEdit = false
        return Response.json({ detail: 'Не удалось сохранить изменения. Повторите сохранение.' }, { status: 503 })
      }
      const formNoteAtSave = client.notes
      const payload = JSON.parse(String(init?.body))
      if (payload.telegramContactUsername) {
        const username = payload.telegramContactUsername.replace(/^@/, '').trim()
        payload.telegramContactUsername = username ? '@' + username : null
      }
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
    if (path.startsWith('/clients/preview-client/messenger/telegram')) {
      if (!client.messengerCapabilities.visible) return Response.json({}, { status: 403 })
      const connection = connected ? { status: 'Connected', telegramUsername: 'alexey_example', telegramDisplayName: client.fullName } :
        { status: pendingLinkExpiresAt ? 'PendingLink' : 'NotConnected', pendingLinkExpiresAt }
      if (path.endsWith('/telegram')) return Response.json({
        capabilities: client.messengerCapabilities, connection, totalMessageCount: messages.length,
      })
      if (path.endsWith('/link-token') && method === 'POST' && !connected) {
        pendingLinkExpiresAt = new Date(Date.now() + 3600000).toISOString()
        return Response.json({ deepLinkUrl: 'https://example.invalid/telegram/demo', qrCodeSvg: demoQr,
          expiresAt: pendingLinkExpiresAt, connection: { status: 'PendingLink', pendingLinkExpiresAt } })
      }
      if (path.endsWith('/messages') && method === 'GET') return Response.json({ items: messages, totalCount: messages.length })
      if (path.endsWith('/messages') && method === 'POST' && connected) {
        if (failReply) {
          failReply = false
          return Response.json({ detail: 'Не удалось отправить сообщение. Попробуйте ещё раз.' }, { status: 503 })
        }
        const { text, idempotencyKey } = JSON.parse(String(init?.body))
        const existing = messages.find(message => message.id === idempotencyKey)
        if (existing) return Response.json(existing)
        const message: Partial<ClientMessengerMessage> = { id: idempotencyKey, text, direction: 'Outbound',
          status: 'SentToTelegram', createdByUserName: 'Мария Орлова', createdAt: new Date().toISOString() }
        messages.push(message)
        return Response.json(message)
      }
      if (path.endsWith('/read')) return Response.json({ unreadCount: 0 })
    }
    return Response.json({ detail: 'Эта операция доступна в рабочей CRM. Прототип показывает расположение и форму.' }, {status: 422})
  }
  return client
}
