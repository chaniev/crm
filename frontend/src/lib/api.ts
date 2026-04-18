const apiBasePath = import.meta.env.VITE_API_BASE_PATH ?? '/api'
const API_ENDPOINTS = {
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
    archive: (clientId: string) => `/clients/${clientId}/archive`,
    restore: (clientId: string) => `/clients/${clientId}/restore`,
  },
  groups: {
    collection: '/groups',
    byId: (groupId: string) => `/groups/${groupId}`,
    trainerOptions: '/groups/options/trainers',
    clients: (groupId: string) => `/groups/${groupId}/clients`,
  },
} as const
const JSON_CONTENT_TYPE = 'application/json'
const GET_METHOD = 'GET'
const HEAD_METHOD = 'HEAD'
const CSRF_HEADER_NAME = 'X-CSRF-TOKEN'
const DEFAULT_REQUEST_ERROR_MESSAGE = 'Не удалось выполнить запрос.'
const DEFAULT_FIELD_ERROR_MESSAGE = 'Проверьте значение поля.'
const CLIENT_STATUS_ACTIVE: ClientStatus = 'Active'
const CLIENT_STATUS_ARCHIVED: ClientStatus = 'Archived'
const DEFAULT_CLIENT_GROUP_NAME = 'Группа без названия'
const GROUPS_DEFAULT_PAGE = 1
const GROUPS_DEFAULT_PAGE_SIZE = 100
const GROUPS_QUERY_KEYS = {
  page: 'page',
  pageSize: 'pageSize',
  skip: 'skip',
  take: 'take',
  isActive: 'isActive',
} as const
const CLIENT_LIST_PAYLOAD_KEYS = ['items', 'clients'] as const
const CLIENT_CONTACT_PAYLOAD_KEYS = ['items', 'contacts'] as const
const CLIENT_GROUP_PAYLOAD_KEYS = ['items', 'groups'] as const

let csrfToken = ''

export type AppSection =
  | 'Home'
  | 'Attendance'
  | 'Clients'
  | 'Groups'
  | 'Users'
  | 'Audit'

export type AccessPermissions = {
  canManageUsers: boolean
  canManageClients: boolean
  canManageGroups: boolean
  canMarkAttendance: boolean
  canViewAuditLog: boolean
}

export type AuthenticatedUser = {
  id: string
  fullName: string
  login: string
  role: 'HeadCoach' | 'Administrator' | 'Coach'
  mustChangePassword: boolean
  isActive: boolean
  landingScreen: AppSection
  allowedSections: AppSection[]
  permissions: AccessPermissions
  assignedGroupIds: string[]
}

export type SessionResponse = {
  isAuthenticated: boolean
  csrfToken: string
  user: AuthenticatedUser | null
}

export type LoginRequest = {
  login: string
  password: string
}

export type ChangePasswordRequest = {
  currentPassword: string
  newPassword: string
}

export type UserRole = AuthenticatedUser['role']

export type UserListItem = {
  id: string
  fullName: string
  login: string
  role: UserRole
  mustChangePassword: boolean
  isActive: boolean
}

export type UserDetails = UserListItem

export type CreateUserRequest = {
  fullName: string
  login: string
  password: string
  role: UserRole
  mustChangePassword: boolean
  isActive: boolean
}

export type UpdateUserRequest = {
  fullName: string
  login: string
  role: UserRole
  mustChangePassword: boolean
  isActive: boolean
}

export type GroupTrainerSummary = {
  id: string
  fullName: string
  login?: string
}

export type ClientStatus = 'Active' | 'Archived'

export type ClientContact = {
  id?: string
  type: string
  fullName: string
  phone: string
}

export type ClientGroupSummary = {
  id: string
  name: string
  isActive: boolean
  trainingStartTime?: string
  scheduleText?: string
}

export type ClientListItem = {
  id: string
  fullName: string
  lastName: string
  firstName: string
  middleName: string
  phone: string
  status: ClientStatus
  contactCount: number
  groupCount: number
  groups: ClientGroupSummary[]
  updatedAt?: string
}

export type ClientDetails = ClientListItem & {
  createdAt?: string
  contacts: ClientContact[]
  groupIds: string[]
}

export type ClientContactInput = {
  type: string
  fullName: string
  phone: string
}

export type UpsertClientRequest = {
  lastName?: string
  firstName?: string
  middleName?: string
  phone: string
  contacts: ClientContactInput[]
  groupIds: string[]
}

export type TrainerOption = {
  id: string
  fullName: string
  login: string
}

export type GroupClient = {
  id: string
  fullName: string
  status: string
  phone?: string
}

export type GroupClientsResponse = {
  groupId: string
  clients: GroupClient[]
}

export type TrainingGroupListItem = {
  id: string
  name: string
  trainingStartTime: string
  scheduleText: string
  isActive: boolean
  trainers: GroupTrainerSummary[]
  trainerIds: string[]
  trainerCount: number
  trainerNames: string[]
  clientCount: number
  updatedAt?: string
}

export type TrainingGroupListResponse = {
  items: TrainingGroupListItem[]
  totalCount: number
  skip: number
  take: number
}

export type TrainingGroupDetails = {
  id: string
  name: string
  trainingStartTime: string
  scheduleText: string
  isActive: boolean
  trainerIds: string[]
  trainers: GroupTrainerSummary[]
  clientCount: number
  updatedAt?: string
  createdAt?: string
}

export type UpsertTrainingGroupRequest = {
  name: string
  trainingStartTime: string
  scheduleText: string
  isActive: boolean
  trainerIds: string[]
}

type ProblemPayload = {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
  csrfToken?: string
}

type GroupResponsePayload = {
  id: string
  name: string
  trainingStartTime: string
  scheduleText: string
  isActive: boolean
  trainers: Array<{
    id: string
    fullName: string
    login: string
  }>
  trainerIds: string[]
  clientCount: number
  updatedAt?: string
  createdAt?: string
  trainerNames?: string[]
  trainerCount?: number
}

type GroupsListEnvelopePayload = {
  items: GroupResponsePayload[]
  totalCount?: number
  skip?: number
  take?: number
}

type GroupClientResponsePayload = {
  id: string
  fullName: string
  status: string
  phone?: string
}

type GroupTrainerOptionPayload = {
  id: string
  fullName: string
  login: string
}

type ClientContactPayload = {
  id?: string
  type?: string | null
  fullName?: string | null
  phone?: string | null
}

type ClientGroupPayload = {
  id: string
  name?: string | null
  groupName?: string | null
  title?: string | null
  isActive?: boolean | null
  trainingStartTime?: string | null
  scheduleText?: string | null
}

type ClientResponsePayload = {
  id: string
  lastName?: string | null
  firstName?: string | null
  middleName?: string | null
  fullName?: string | null
  phone?: string | null
  status?: string | null
  contactCount?: number | null
  groupCount?: number | null
  contacts?: ClientContactPayload[] | Record<string, unknown>
  groups?: ClientGroupPayload[] | Record<string, unknown>
  clientGroups?: ClientGroupPayload[] | Record<string, unknown>
  groupIds?: string[] | null
  updatedAt?: string
  createdAt?: string
}

export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string[]>

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? GET_METHOD).toUpperCase()
  const headers = new Headers(init.headers)

  headers.set('Accept', JSON_CONTENT_TYPE)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', JSON_CONTENT_TYPE)
  }

  if (method !== GET_METHOD && method !== HEAD_METHOD && csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  const response = await fetch(`${apiBasePath}${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as ProblemPayload & T)
    : null

  if (payload?.csrfToken) {
    csrfToken = payload.csrfToken
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.detail ?? payload?.title ?? DEFAULT_REQUEST_ERROR_MESSAGE,
      response.status,
      payload?.errors ?? {},
    )
  }

  return payload as T
}

export function applyFieldErrors(
  fieldErrors: Record<string, string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      normalizeFieldPath(field),
      messages[0] ?? DEFAULT_FIELD_ERROR_MESSAGE,
    ]),
  )
}

export async function getClients(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.clients.collection, { signal })

  return extractArrayPayload<ClientResponsePayload>(
    payload,
    CLIENT_LIST_PAYLOAD_KEYS,
  ).map(mapClientListItem)
}

export async function getClient(clientId: string, signal?: AbortSignal) {
  const payload = await request<ClientResponsePayload>(
    API_ENDPOINTS.clients.byId(clientId),
    { signal },
  )

  return mapClientDetails(payload)
}

export async function createClient(payload: UpsertClientRequest) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.collection,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function updateClient(
  clientId: string,
  payload: UpsertClientRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.byId(clientId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function archiveClient(clientId: string) {
  return request<void>(API_ENDPOINTS.clients.archive(clientId), {
    method: 'PUT',
  })
}

export async function restoreClient(clientId: string) {
  return request<void>(API_ENDPOINTS.clients.restore(clientId), {
    method: 'PUT',
  })
}

export async function loadSession(signal?: AbortSignal) {
  return request<SessionResponse>(API_ENDPOINTS.auth.session, { signal })
}

export async function login(payload: LoginRequest) {
  return request<SessionResponse>(API_ENDPOINTS.auth.login, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout() {
  return request<SessionResponse>(API_ENDPOINTS.auth.logout, {
    method: 'POST',
  })
}

export async function changePassword(payload: ChangePasswordRequest) {
  return request<SessionResponse>(API_ENDPOINTS.auth.changePassword, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getUsers(signal?: AbortSignal) {
  return request<UserListItem[]>(API_ENDPOINTS.users.collection, { signal })
}

export async function getUser(userId: string, signal?: AbortSignal) {
  return request<UserDetails>(API_ENDPOINTS.users.byId(userId), { signal })
}

export async function createUser(payload: CreateUserRequest) {
  return request<void>(API_ENDPOINTS.users.collection, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateUser(userId: string, payload: UpdateUserRequest) {
  return request<void>(API_ENDPOINTS.users.byId(userId), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function getGroups(
  params: {
    page?: number
    pageSize?: number
    skip?: number
    take?: number
    isActive?: boolean
  } = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()

  if (typeof params.page === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.page, String(params.page))
  } else if (typeof params.pageSize === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.page, String(GROUPS_DEFAULT_PAGE))
  }

  if (typeof params.pageSize === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.pageSize, String(params.pageSize))
  }

  if (typeof params.skip === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.skip, String(params.skip))
  }

  if (typeof params.take === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.take, String(params.take))
  }

  if (typeof params.isActive === 'boolean') {
    searchParams.set(GROUPS_QUERY_KEYS.isActive, String(params.isActive))
  }

  if (
    !searchParams.has(GROUPS_QUERY_KEYS.page) &&
    !searchParams.has(GROUPS_QUERY_KEYS.pageSize) &&
    !searchParams.has(GROUPS_QUERY_KEYS.skip) &&
    !searchParams.has(GROUPS_QUERY_KEYS.take)
  ) {
    searchParams.set(GROUPS_QUERY_KEYS.page, String(GROUPS_DEFAULT_PAGE))
    searchParams.set(GROUPS_QUERY_KEYS.pageSize, String(GROUPS_DEFAULT_PAGE_SIZE))
  }

  const payload = await request<GroupResponsePayload[] | GroupsListEnvelopePayload>(
    `${API_ENDPOINTS.groups.collection}?${searchParams.toString()}`,
    { signal },
  )

  if (Array.isArray(payload)) {
    const items = payload.map(mapGroupListItem)

    return {
      items,
      totalCount: items.length,
      skip: 0,
      take: items.length,
    } satisfies TrainingGroupListResponse
  }

  const items = payload.items.map(mapGroupListItem)

  return {
    items,
    totalCount: payload.totalCount ?? items.length,
    skip: payload.skip ?? 0,
    take: payload.take ?? items.length,
  } satisfies TrainingGroupListResponse
}

export async function getGroup(groupId: string, signal?: AbortSignal) {
  const payload = await request<GroupResponsePayload>(API_ENDPOINTS.groups.byId(groupId), {
    signal,
  })

  return mapGroupDetails(payload)
}

export async function getTrainerOptions(signal?: AbortSignal) {
  const payload = await request<GroupTrainerOptionPayload[]>(
    API_ENDPOINTS.groups.trainerOptions,
    { signal },
  )

  return payload.map((trainer) => ({
    id: trainer.id,
    fullName: trainer.fullName,
    login: trainer.login,
  }))
}

export async function getGroupClients(groupId: string, signal?: AbortSignal) {
  const payload = await request<GroupClientResponsePayload[] | { clients: GroupClientResponsePayload[] }>(
    API_ENDPOINTS.groups.clients(groupId),
    { signal },
  )

  const clientsPayload = Array.isArray(payload) ? payload : payload.clients

  return {
    groupId,
    clients: clientsPayload.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      status: client.status,
      phone: client.phone,
    })),
  } satisfies GroupClientsResponse
}

export async function createGroup(payload: UpsertTrainingGroupRequest) {
  const response = await request<GroupResponsePayload>(API_ENDPOINTS.groups.collection, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapGroupDetails(response)
}

export async function updateGroup(
  groupId: string,
  payload: UpsertTrainingGroupRequest,
) {
  const response = await request<GroupResponsePayload>(
    API_ENDPOINTS.groups.byId(groupId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return mapGroupDetails(response)
}

function mapGroupListItem(payload: GroupResponsePayload): TrainingGroupListItem {
  const trainers = payload.trainers.map(mapGroupTrainerSummary)

  return {
    id: payload.id,
    name: payload.name,
    trainingStartTime: payload.trainingStartTime,
    scheduleText: payload.scheduleText,
    isActive: payload.isActive,
    trainers,
    trainerIds:
      payload.trainerIds.length > 0
        ? payload.trainerIds
        : trainers.map((trainer) => trainer.id),
    trainerCount: payload.trainerCount ?? trainers.length,
    clientCount: payload.clientCount,
    trainerNames: payload.trainerNames ?? trainers.map((trainer) => trainer.fullName),
    updatedAt: payload.updatedAt,
  }
}

function mapGroupDetails(payload: GroupResponsePayload): TrainingGroupDetails {
  return {
    id: payload.id,
    name: payload.name,
    trainingStartTime: payload.trainingStartTime,
    scheduleText: payload.scheduleText,
    isActive: payload.isActive,
    trainerIds: payload.trainerIds,
    trainers: payload.trainers.map(mapGroupTrainerSummary),
    clientCount: payload.clientCount,
    updatedAt: payload.updatedAt,
    createdAt: payload.createdAt,
  }
}

function mapGroupTrainerSummary(trainer: GroupResponsePayload['trainers'][number]) {
  return {
    id: trainer.id,
    fullName: trainer.fullName,
    login: trainer.login,
  }
}

function normalizeFieldPath(field: string) {
  if (field === 'fullName') {
    return 'lastName'
  }

  return field
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => {
      if (!segment || /^\d+$/.test(segment)) {
        return segment
      }

      return segment.charAt(0).toLowerCase() + segment.slice(1)
    })
    .join('.')
}

function extractArrayPayload<T>(payload: unknown, keys: readonly string[]): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (!isRecord(payload)) {
    return []
  }

  for (const key of keys) {
    const candidate = payload[key]
    if (Array.isArray(candidate)) {
      return candidate as T[]
    }
  }

  const nestedData = payload.data

  if (Array.isArray(nestedData)) {
    return nestedData as T[]
  }

  if (isRecord(nestedData)) {
    for (const key of keys) {
      const candidate = nestedData[key]
      if (Array.isArray(candidate)) {
        return candidate as T[]
      }
    }
  }

  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function mapClientListItem(payload: ClientResponsePayload): ClientListItem {
  const contacts = mapClientContacts(payload)
  const groups = mapClientGroups(payload)
  const fullName = buildClientFullName(payload)

  return {
    id: payload.id,
    fullName,
    lastName: payload.lastName?.trim() ?? '',
    firstName: payload.firstName?.trim() ?? '',
    middleName: payload.middleName?.trim() ?? '',
    phone: payload.phone?.trim() ?? '',
    status: mapClientStatus(payload.status),
    contactCount: payload.contactCount ?? contacts.length,
    groupCount: payload.groupCount ?? groups.length,
    groups,
    updatedAt: payload.updatedAt,
  }
}

function mapClientDetails(payload: ClientResponsePayload): ClientDetails {
  const listItem = mapClientListItem(payload)
  const groupIds =
    payload.groupIds?.filter((groupId): groupId is string => Boolean(groupId)) ??
    listItem.groups.map((group) => group.id)

  return {
    ...listItem,
    contacts: mapClientContacts(payload),
    createdAt: payload.createdAt,
    groupIds,
  }
}

function mapClientContacts(payload: ClientResponsePayload): ClientContact[] {
  return extractArrayPayload<ClientContactPayload>(
    payload.contacts,
    CLIENT_CONTACT_PAYLOAD_KEYS,
  ).map((contact) => ({
    id: contact.id,
    type: contact.type?.trim() ?? '',
    fullName: contact.fullName?.trim() ?? '',
    phone: contact.phone?.trim() ?? '',
  }))
}

function mapClientGroups(payload: ClientResponsePayload): ClientGroupSummary[] {
  const groupsPayload = extractArrayPayload<ClientGroupPayload>(
    payload.groups,
    CLIENT_GROUP_PAYLOAD_KEYS,
  )

  const fallbackGroupsPayload =
    groupsPayload.length > 0
      ? groupsPayload
      : extractArrayPayload<ClientGroupPayload>(
          payload.clientGroups,
          CLIENT_GROUP_PAYLOAD_KEYS,
        )

  return fallbackGroupsPayload.map((group) => ({
    id: group.id,
    name:
      group.name?.trim() ??
      group.groupName?.trim() ??
      group.title?.trim() ??
      DEFAULT_CLIENT_GROUP_NAME,
    isActive: group.isActive ?? true,
    trainingStartTime: group.trainingStartTime ?? undefined,
    scheduleText: group.scheduleText ?? undefined,
  }))
}

function buildClientFullName(payload: Pick<
  ClientResponsePayload,
  'fullName' | 'lastName' | 'firstName' | 'middleName'
>) {
  const fullName = [payload.lastName, payload.firstName, payload.middleName]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join(' ')

  if (fullName) {
    return fullName
  }

  return payload.fullName?.trim() || 'Без имени'
}

function mapClientStatus(status?: string | null): ClientStatus {
  return status === CLIENT_STATUS_ARCHIVED
    ? CLIENT_STATUS_ARCHIVED
    : CLIENT_STATUS_ACTIVE
}
