import type { ClientStatus } from './types'

export const apiBasePath = import.meta.env.VITE_API_BASE_PATH ?? '/api'

export const API_ENDPOINTS = {
  auth: {
    session: '/auth/session',
    login: '/auth/login',
    logout: '/auth/logout',
    changePassword: '/auth/change-password',
  },
  users: {
    collection: '/users',
    byId: (userId: string) => `/users/${userId}`,
  },
  clients: {
    collection: '/clients',
    byId: (clientId: string) => `/clients/${clientId}`,
    expiringMemberships: '/clients/expiring-memberships',
    photo: (clientId: string) => `/clients/${clientId}/photo`,
    archive: (clientId: string) => `/clients/${clientId}/archive`,
    restore: (clientId: string) => `/clients/${clientId}/restore`,
    membership: {
      purchase: (clientId: string) => `/clients/${clientId}/membership/purchase`,
      renew: (clientId: string) => `/clients/${clientId}/membership/renew`,
      correct: (clientId: string) => `/clients/${clientId}/membership/correct`,
      markPayment: (clientId: string) =>
        `/clients/${clientId}/membership/mark-payment`,
    },
  },
  groups: {
    collection: '/groups',
    byId: (groupId: string) => `/groups/${groupId}`,
    trainerOptions: '/groups/options/trainers',
    clients: (groupId: string) => `/groups/${groupId}/clients`,
  },
  attendance: {
    groups: '/attendance/groups',
    groupClients: (groupId: string) => `/attendance/groups/${groupId}/clients`,
    groupMarks: (groupId: string) => `/attendance/groups/${groupId}`,
  },
  audit: {
    collection: '/audit-logs',
    options: '/audit-logs/options',
  },
} as const

export const JSON_CONTENT_TYPE = 'application/json'
export const GET_METHOD = 'GET'
export const HEAD_METHOD = 'HEAD'
export const CSRF_HEADER_NAME = 'X-CSRF-TOKEN'
export const DEFAULT_REQUEST_ERROR_MESSAGE = 'Не удалось выполнить запрос.'
export const DEFAULT_FIELD_ERROR_MESSAGE = 'Проверьте значение поля.'

export const CLIENT_STATUS_ACTIVE: ClientStatus = 'Active'
export const CLIENT_STATUS_ARCHIVED: ClientStatus = 'Archived'
export const DEFAULT_CLIENT_GROUP_NAME = 'Группа без названия'

export const GROUPS_DEFAULT_PAGE = 1
export const GROUPS_DEFAULT_PAGE_SIZE = 100
export const GROUPS_QUERY_KEYS = {
  page: 'page',
  pageSize: 'pageSize',
  skip: 'skip',
  take: 'take',
  isActive: 'isActive',
} as const

export const CLIENTS_DEFAULT_PAGE = 1
export const CLIENTS_DEFAULT_PAGE_SIZE = 20
export const CLIENTS_QUERY_KEYS = {
  page: 'page',
  pageSize: 'pageSize',
  skip: 'skip',
  take: 'take',
  fullName: 'fullName',
  phone: 'phone',
  groupId: 'groupId',
  status: 'status',
  paymentStatus: 'paymentStatus',
  membershipExpiresFrom: 'membershipExpiresFrom',
  membershipExpiresTo: 'membershipExpiresTo',
  hasPhoto: 'hasPhoto',
  hasGroup: 'hasGroup',
  hasActivePaidMembership: 'hasActivePaidMembership',
} as const

export const CLIENT_LIST_PAYLOAD_KEYS = ['items', 'clients'] as const
export const CLIENT_CONTACT_PAYLOAD_KEYS = ['items', 'contacts'] as const
export const CLIENT_GROUP_PAYLOAD_KEYS = ['items', 'groups'] as const
export const CLIENT_MEMBERSHIP_PAYLOAD_KEYS = [
  'membershipHistory',
  'MembershipHistory',
  'membershipHistoryItems',
  'MembershipHistoryItems',
] as const
export const CLIENT_ATTENDANCE_HISTORY_PAYLOAD_KEYS = [
  'attendanceHistory',
  'AttendanceHistory',
  'visitHistory',
  'VisitHistory',
  'attendanceEntries',
  'AttendanceEntries',
] as const
export const CLIENT_ATTENDANCE_HISTORY_ITEM_PAYLOAD_KEYS = [
  'items',
  'Items',
  'entries',
  'Entries',
  'attendance',
  'Attendance',
  'visits',
  'Visits',
] as const
export const CLIENT_EXPIRING_MEMBERSHIP_PAYLOAD_KEYS = ['items', 'clients', 'data'] as const
export const ATTENDANCE_GROUP_PAYLOAD_KEYS = ['items', 'groups'] as const
export const ATTENDANCE_CLIENT_PAYLOAD_KEYS = ['items', 'clients'] as const

export const AUDIT_DEFAULT_PAGE = 1
export const AUDIT_DEFAULT_PAGE_SIZE = 20
export const AUDIT_QUERY_KEYS = {
  page: 'page',
  pageSize: 'pageSize',
  skip: 'skip',
  take: 'take',
  userId: 'userId',
  source: 'source',
  messengerPlatform: 'messengerPlatform',
  actionType: 'actionType',
  entityType: 'entityType',
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
} as const

export const AUDIT_LOG_PAYLOAD_KEYS = [
  'items',
  'entries',
  'auditLogs',
  'auditLogEntries',
  'logs',
] as const
