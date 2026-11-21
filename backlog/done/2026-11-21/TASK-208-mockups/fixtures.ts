import type { AuditLogEntry, AuditLogFilterUser, AuthenticatedUser, GetAuditLogParams } from '../../../../frontend/src/lib/api/types'
export { ApiError } from '../../../../frontend/src/lib/api'

const users: AuditLogFilterUser[] = [
  { id: '1', fullName: 'Ирина Волкова', login: 'i.volkova', role: 'HeadCoach' },
  { id: '2', fullName: 'Александра Константиновна Соловьёва-Воскресенская', login: 'a.soloveva', role: 'Administrator' },
  { id: '3', fullName: 'Максим Лебедев', login: 'm.lebedev', role: 'Coach' },
]
export const user: AuthenticatedUser = {
  id: '1', fullName: users[0].fullName, login: users[0].login, role: 'HeadCoach',
  mustChangePassword: false, isActive: true, landingScreen: 'Audit', allowedSections: ['Audit'],
  permissions: {
    canManageUsers: false, canManageClients: false, canManageGroups: false, canManageSettings: false,
    canMarkAttendance: false, canViewAuditLog: true, canViewFinancialReports: false,
  },
  assignedGroupIds: [], attendanceScope: { kind: 'Global', groupIds: [] }, branchId: null,
}
const samples = [
  { actor: 0, time: '18:42', action: 'ClientCreated', entity: 'Client', description: 'Создан клиент Антон Белов.' },
  { actor: 1, time: '18:36', action: 'ClientNoteChanged', entity: 'Client',
    description: 'Обновлена рабочая заметка клиента Константина Воронцова после обсуждения переноса занятий из вечерней группы в утреннюю.' },
  { actor: 2, time: '18:24', action: 'BotAttendanceSaved', entity: 'Attendance',
    description: 'Сохранены отметки посещения группы «Юниоры».' },
  { actor: 0, time: '18:08', action: 'ClientImportCompleted', entity: 'ClientImport', description: 'Импорт клиентов завершён.' },
  { actor: 1, time: '17:51', action: 'ClientMembershipRenewed', entity: 'ClientMembership', description: 'Продлён абонемент клиента Марии Соколовой на восемь занятий.' },
  { actor: 0, time: '17:40', action: 'Login', entity: 'UserSession', description: 'Выполнен вход в систему.' },
]
const entries: AuditLogEntry[] = Array.from({ length: 24 }, (_, index) => {
  const sample = samples[index % samples.length]
  const actor = users[sample.actor]
  const day = 21 - Math.floor(index / samples.length)
  const bot = sample.action === 'BotAttendanceSaved'
  return {
    id: String(index + 1), createdAt: '2026-11-' + day + 'T' + sample.time + ':00',
    userId: actor.id, userName: actor.fullName, userLogin: actor.login, userRole: actor.role,
    source: bot ? 'Bot' : 'Web', messengerPlatform: bot ? 'Telegram' : undefined,
    actionType: sample.action, entityType: sample.entity,
    entityId: '11ce7a01-8e9d-4dc1-a137-' + String(index + 1).padStart(12, '0'),
    description: sample.description, oldValueJson: sample.action === 'ClientNoteChanged' ? { note: 'Вечерняя группа' } : null,
    newValueJson: sample.action === 'ClientNoteChanged' ? { note: 'Переходит в утреннюю группу' } : null,
  }
})
export async function getAuditLogFilterOptions() {
  return { users, sources: ['Web', 'Bot'], messengerPlatforms: ['Telegram'],
    actionTypes: [...new Set(entries.map(entry => entry.actionType))],
    entityTypes: [...new Set(entries.map(entry => entry.entityType))] }
}
let simulateError = location.hash === '#error'
export async function getAuditLogEntries(params: GetAuditLogParams) {
  if (simulateError) {
    simulateError = false
    throw new Error('Не удалось загрузить записи журнала.')
  }
  const filtered = entries.filter(entry => {
    const date = entry.createdAt.slice(0, 10)
    return (!params.dateFrom || date >= params.dateFrom) && (!params.dateTo || date <= params.dateTo)
      && (['source', 'actionType', 'entityType', 'messengerPlatform', 'userId'] as const)
        .every(key => !params[key] || params[key] === entry[key])
  })
  const page = params.page ?? 1
  const size = params.pageSize ?? 20
  const start = (page - 1) * size
  return { items: filtered.slice(start, start + size), page, pageSize: size, totalCount: filtered.length,
    skip: start, take: size, hasNextPage: start + size < filtered.length }
}
