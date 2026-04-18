const apiBasePath = import.meta.env.VITE_API_BASE_PATH ?? '/api'

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
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)

  headers.set('Accept', 'application/json')

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (method !== 'GET' && method !== 'HEAD' && csrfToken) {
    headers.set('X-CSRF-TOKEN', csrfToken)
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
      payload?.detail ?? payload?.title ?? 'Не удалось выполнить запрос.',
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
      messages[0] ?? 'Проверьте значение поля.',
    ]),
  )
}

export async function getClients(signal?: AbortSignal) {
  const payload = await request<unknown>('/clients', { signal })

  return extractArrayPayload<ClientResponsePayload>(payload, [
    'items',
    'clients',
  ]).map(mapClientListItem)
}

export async function getClient(clientId: string, signal?: AbortSignal) {
  const payload = await request<ClientResponsePayload>(`/clients/${clientId}`, {
    signal,
  })

  return mapClientDetails(payload)
}

export async function createClient(payload: UpsertClientRequest) {
  const response = await request<ClientResponsePayload | null>('/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return response ? mapClientDetails(response) : null
}

export async function updateClient(
  clientId: string,
  payload: UpsertClientRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    `/clients/${clientId}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function archiveClient(clientId: string) {
  return request<void>(`/clients/${clientId}/archive`, {
    method: 'PUT',
  })
}

export async function restoreClient(clientId: string) {
  return request<void>(`/clients/${clientId}/restore`, {
    method: 'PUT',
  })
}

export async function loadSession(signal?: AbortSignal) {
  return request<SessionResponse>('/auth/session', { signal })
}

export async function login(payload: LoginRequest) {
  return request<SessionResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout() {
  return request<SessionResponse>('/auth/logout', {
    method: 'POST',
  })
}

export async function changePassword(payload: ChangePasswordRequest) {
  return request<SessionResponse>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getUsers(signal?: AbortSignal) {
  return request<UserListItem[]>('/users', { signal })
}

export async function getUser(userId: string, signal?: AbortSignal) {
  return request<UserDetails>(`/users/${userId}`, { signal })
}

export async function createUser(payload: CreateUserRequest) {
  return request<void>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateUser(userId: string, payload: UpdateUserRequest) {
  return request<void>(`/users/${userId}`, {
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
    searchParams.set('page', String(params.page))
  } else if (typeof params.pageSize === 'number') {
    searchParams.set('page', '1')
  }

  if (typeof params.pageSize === 'number') {
    searchParams.set('pageSize', String(params.pageSize))
  }

  if (typeof params.skip === 'number') {
    searchParams.set('skip', String(params.skip))
  }

  if (typeof params.take === 'number') {
    searchParams.set('take', String(params.take))
  }

  if (typeof params.isActive === 'boolean') {
    searchParams.set('isActive', String(params.isActive))
  }

  if (
    !searchParams.has('page') &&
    !searchParams.has('pageSize') &&
    !searchParams.has('skip') &&
    !searchParams.has('take')
  ) {
    searchParams.set('page', '1')
    searchParams.set('pageSize', '100')
  }

  const payload = await request<GroupResponsePayload[] | GroupsListEnvelopePayload>(
    `/groups?${searchParams.toString()}`,
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
  const payload = await request<GroupResponsePayload>(`/groups/${groupId}`, {
    signal,
  })

  return mapGroupDetails(payload)
}

export async function getTrainerOptions(signal?: AbortSignal) {
  const payload = await request<GroupTrainerOptionPayload[]>(
    '/groups/options/trainers',
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
    `/groups/${groupId}/clients`,
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
  const response = await request<GroupResponsePayload>('/groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapGroupDetails(response)
}

export async function updateGroup(
  groupId: string,
  payload: UpsertTrainingGroupRequest,
) {
  const response = await request<GroupResponsePayload>(`/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

  return mapGroupDetails(response)
}

function mapGroupListItem(payload: GroupResponsePayload): TrainingGroupListItem {
  return {
    id: payload.id,
    name: payload.name,
    trainingStartTime: payload.trainingStartTime,
    scheduleText: payload.scheduleText,
    isActive: payload.isActive,
    trainers: payload.trainers.map((trainer) => ({
      id: trainer.id,
      fullName: trainer.fullName,
      login: trainer.login,
    })),
    trainerIds:
      payload.trainerIds.length > 0
        ? payload.trainerIds
        : payload.trainers.map((trainer) => trainer.id),
    trainerCount: payload.trainerCount ?? payload.trainers.length,
    clientCount: payload.clientCount,
    trainerNames:
      payload.trainerNames ?? payload.trainers.map((trainer) => trainer.fullName),
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
    trainers: payload.trainers.map((trainer) => ({
      id: trainer.id,
      fullName: trainer.fullName,
      login: trainer.login,
    })),
    clientCount: payload.clientCount,
    updatedAt: payload.updatedAt,
    createdAt: payload.createdAt,
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

function extractArrayPayload<T>(payload: unknown, keys: string[]): T[] {
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
  return extractArrayPayload<ClientContactPayload>(payload.contacts, [
    'items',
    'contacts',
  ]).map((contact) => ({
    id: contact.id,
    type: contact.type?.trim() ?? '',
    fullName: contact.fullName?.trim() ?? '',
    phone: contact.phone?.trim() ?? '',
  }))
}

function mapClientGroups(payload: ClientResponsePayload): ClientGroupSummary[] {
  const groupsPayload = extractArrayPayload<ClientGroupPayload>(payload.groups, [
    'items',
    'groups',
  ])

  const fallbackGroupsPayload =
    groupsPayload.length > 0
      ? groupsPayload
      : extractArrayPayload<ClientGroupPayload>(payload.clientGroups, [
          'items',
          'groups',
        ])

  return fallbackGroupsPayload.map((group) => ({
    id: group.id,
    name:
      group.name?.trim() ??
      group.groupName?.trim() ??
      group.title?.trim() ??
      'Группа без названия',
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
  return status === 'Archived' ? 'Archived' : 'Active'
}
