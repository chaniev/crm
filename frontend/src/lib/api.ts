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
const CLIENTS_DEFAULT_PAGE = 1
const CLIENTS_DEFAULT_PAGE_SIZE = 20
const CLIENTS_QUERY_KEYS = {
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
const CLIENT_LIST_PAYLOAD_KEYS = ['items', 'clients'] as const
const CLIENT_CONTACT_PAYLOAD_KEYS = ['items', 'contacts'] as const
const CLIENT_GROUP_PAYLOAD_KEYS = ['items', 'groups'] as const
const CLIENT_MEMBERSHIP_PAYLOAD_KEYS = [
  'membershipHistory',
  'MembershipHistory',
  'membershipHistoryItems',
  'MembershipHistoryItems',
] as const

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
export type ClientPaymentStatus = 'Paid' | 'Unpaid'

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

export type ClientPhoto = {
  path?: string
  contentType?: string
  sizeBytes?: number
  uploadedAt?: string
}

export type MembershipType = 'SingleVisit' | 'Monthly' | 'Yearly'

export type ClientMembershipChangeReason =
  | 'NewPurchase'
  | 'Renewal'
  | 'Correction'
  | 'PaymentUpdate'
  | 'SingleVisitWriteOff'

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

export type ClientMembership = {
  id: string
  membershipType: MembershipType
  purchaseDate: string
  expirationDate: string | null
  paymentAmount: number
  isPaid: boolean
  singleVisitUsed: boolean
  changeReason?: ClientMembershipChangeReason | string
  paidAt?: string
  paidByUserId?: string
  paidByUserName?: string
  changedByUserId?: string
  changedByUserName?: string
  validFrom?: string
  validTo?: string | null
  createdAt?: string
}

export type ClientDetails = ClientListItem & {
  createdAt?: string
  contacts: ClientContact[]
  groupIds: string[]
  photo: ClientPhoto | null
  currentMembership: ClientMembership | null
  membershipHistory: ClientMembership[]
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

export type GetClientsParams = {
  page?: number
  pageSize?: number
  skip?: number
  take?: number
  fullName?: string
  phone?: string
  groupId?: string
  status?: ClientStatus
  paymentStatus?: ClientPaymentStatus
  membershipExpiresFrom?: string
  membershipExpiresTo?: string
  hasPhoto?: boolean
  hasGroup?: boolean
  hasActivePaidMembership?: boolean
}

export type ClientListResponse = {
  items: ClientListItem[]
  totalCount: number | null
  skip: number
  take: number
  page: number
  pageSize: number
  hasNextPage: boolean
}

export type PurchaseClientMembershipRequest = {
  membershipType: MembershipType
  purchaseDate: string
  expirationDate?: string
  paymentAmount: number
  isPaid: boolean
  singleVisitUsed?: boolean
}

export type CorrectClientMembershipRequest = PurchaseClientMembershipRequest

export type RenewClientMembershipRequest = {
  membershipType: MembershipType
  renewalDate: string
  paymentDate?: string
  expirationDate?: string
  paymentAmount: number
  isPaid: boolean
}

export type MarkClientMembershipPaymentRequest = {
  membershipType: MembershipType
  paymentAmount: number
  isPaid: boolean
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
  photo?: Record<string, unknown> | null
  photoPath?: string | null
  photoContentType?: string | null
  photoSizeBytes?: number | null
  photoUploadedAt?: string | null
  hasPhoto?: boolean | null
  updatedAt?: string
  createdAt?: string
}

type ClientMembershipPayload = Record<string, unknown>

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
  const isFormDataBody = init.body instanceof FormData

  headers.set('Accept', JSON_CONTENT_TYPE)

  if (init.body && !isFormDataBody && !headers.has('Content-Type')) {
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

export async function getClients(
  params: GetClientsParams = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()

  if (typeof params.page === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.page, String(params.page))
  } else if (typeof params.pageSize === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.page, String(CLIENTS_DEFAULT_PAGE))
  }

  if (typeof params.pageSize === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.pageSize, String(params.pageSize))
  }

  if (typeof params.skip === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.skip, String(params.skip))
  }

  if (typeof params.take === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.take, String(params.take))
  }

  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.fullName, params.fullName)
  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.phone, params.phone)
  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.groupId, params.groupId)
  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.status, params.status)
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.paymentStatus,
    params.paymentStatus,
  )
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.membershipExpiresFrom,
    params.membershipExpiresFrom,
  )
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.membershipExpiresTo,
    params.membershipExpiresTo,
  )
  appendBooleanSearchParam(searchParams, CLIENTS_QUERY_KEYS.hasPhoto, params.hasPhoto)
  appendBooleanSearchParam(searchParams, CLIENTS_QUERY_KEYS.hasGroup, params.hasGroup)
  appendBooleanSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.hasActivePaidMembership,
    params.hasActivePaidMembership,
  )

  if (
    !searchParams.has(CLIENTS_QUERY_KEYS.page) &&
    !searchParams.has(CLIENTS_QUERY_KEYS.pageSize) &&
    !searchParams.has(CLIENTS_QUERY_KEYS.skip) &&
    !searchParams.has(CLIENTS_QUERY_KEYS.take)
  ) {
    searchParams.set(CLIENTS_QUERY_KEYS.page, String(CLIENTS_DEFAULT_PAGE))
    searchParams.set(
      CLIENTS_QUERY_KEYS.pageSize,
      String(CLIENTS_DEFAULT_PAGE_SIZE),
    )
  }

  const payload = await request<unknown>(
    `${API_ENDPOINTS.clients.collection}?${searchParams.toString()}`,
    { signal },
  )

  const items = extractArrayPayload<ClientResponsePayload>(
    payload,
    CLIENT_LIST_PAYLOAD_KEYS,
  ).map(mapClientListItem)
  const pagination = extractClientsPagination(payload, params, items.length)

  return {
    items,
    totalCount: pagination.totalCount,
    skip: pagination.skip,
    take: pagination.take,
    page: pagination.page,
    pageSize: pagination.pageSize,
    hasNextPage:
      pagination.totalCount !== null
        ? pagination.skip + items.length < pagination.totalCount
        : items.length >= pagination.take,
  } satisfies ClientListResponse
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

export function buildClientPhotoUrl(
  clientId: string,
  version?: string | number | null,
) {
  const versionSuffix =
    version === undefined || version === null || version === ''
      ? ''
      : `?v=${encodeURIComponent(String(version))}`

  return `${apiBasePath}${API_ENDPOINTS.clients.photo(clientId)}${versionSuffix}`
}

export async function uploadClientPhoto(clientId: string, file: File) {
  const payload = new FormData()
  payload.append('photo', file)

  await request<unknown>(
    API_ENDPOINTS.clients.photo(clientId),
    {
      method: 'POST',
      body: payload,
    },
  )

  return null
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

export async function purchaseClientMembership(
  clientId: string,
  payload: PurchaseClientMembershipRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.purchase(clientId),
    {
      method: 'POST',
      body: JSON.stringify({
        MembershipType: payload.membershipType,
        PurchaseDate: payload.purchaseDate,
        ExpirationDate: payload.expirationDate,
        PaymentAmount: payload.paymentAmount,
        IsPaid: payload.isPaid,
        SingleVisitUsed: payload.singleVisitUsed ?? false,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function renewClientMembership(
  clientId: string,
  payload: RenewClientMembershipRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.renew(clientId),
    {
      method: 'POST',
      body: JSON.stringify({
        MembershipType: payload.membershipType,
        RenewalDate: payload.renewalDate,
        PaymentDate: payload.paymentDate,
        ExpirationDate: payload.expirationDate,
        PaymentAmount: payload.paymentAmount,
        IsPaid: payload.isPaid,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function correctClientMembership(
  clientId: string,
  payload: CorrectClientMembershipRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.correct(clientId),
    {
      method: 'POST',
      body: JSON.stringify({
        MembershipType: payload.membershipType,
        PurchaseDate: payload.purchaseDate,
        ExpirationDate: payload.expirationDate,
        PaymentAmount: payload.paymentAmount,
        IsPaid: payload.isPaid,
        SingleVisitUsed: payload.singleVisitUsed ?? false,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function markClientMembershipPayment(
  clientId: string,
  payload: MarkClientMembershipPaymentRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.markPayment(clientId),
    {
      method: 'POST',
      body: JSON.stringify({
        MembershipType: payload.membershipType,
        PaymentAmount: payload.paymentAmount,
        IsPaid: payload.isPaid,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
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

function appendSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value?: string | null,
) {
  if (!value) {
    return
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return
  }

  searchParams.set(key, trimmedValue)
}

function appendBooleanSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value?: boolean,
) {
  if (typeof value !== 'boolean') {
    return
  }

  searchParams.set(key, String(value))
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

function extractRecordPayload(
  payload: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null
  }

  for (const key of keys) {
    if (!(key in payload)) {
      continue
    }

    const candidate = payload[key]

    if (isRecord(candidate)) {
      return candidate
    }

    if (candidate === null) {
      return null
    }
  }

  const nestedData = payload.data

  if (!isRecord(nestedData)) {
    return null
  }

  for (const key of keys) {
    if (!(key in nestedData)) {
      continue
    }

    const candidate = nestedData[key]

    if (isRecord(candidate)) {
      return candidate
    }

    if (candidate === null) {
      return null
    }
  }

  return null
}

function extractClientsPagination(
  payload: unknown,
  params: GetClientsParams,
  itemCount: number,
) {
  const requestedTake =
    typeof params.take === 'number'
      ? params.take
      : typeof params.pageSize === 'number'
        ? params.pageSize
        : CLIENTS_DEFAULT_PAGE_SIZE
  const requestedSkip =
    typeof params.skip === 'number'
      ? params.skip
      : typeof params.page === 'number'
        ? Math.max(0, (params.page - 1) * requestedTake)
        : 0
  const envelope = isRecord(payload) ? payload : null
  const nestedEnvelope = envelope?.data
  const totalCount =
    (isRecord(envelope)
      ? readNumber(envelope, ['totalCount', 'TotalCount'])
      : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['totalCount', 'TotalCount'])
      : undefined)
  const skip =
    (isRecord(envelope) ? readNumber(envelope, ['skip', 'Skip']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['skip', 'Skip'])
      : undefined) ??
    requestedSkip
  const take =
    (isRecord(envelope) ? readNumber(envelope, ['take', 'Take']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['take', 'Take'])
      : undefined) ??
    requestedTake
  const page =
    (isRecord(envelope) ? readNumber(envelope, ['page', 'Page']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['page', 'Page'])
      : undefined) ??
    Math.floor(skip / Math.max(take, 1)) + 1
  const pageSize =
    (isRecord(envelope)
      ? readNumber(envelope, ['pageSize', 'PageSize'])
      : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['pageSize', 'PageSize'])
      : undefined) ??
    take

  return {
    totalCount: totalCount ?? null,
    skip,
    take: Math.max(take, itemCount, 1),
    page: Math.max(page, 1),
    pageSize: Math.max(pageSize, 1),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasProperty(record: Record<string, unknown>, keys: readonly string[]) {
  return keys.some((key) => key in record)
}

function readString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string') {
      return value.trim()
    }
  }

  return undefined
}

function readBoolean(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'boolean') {
      return value
    }
  }

  return undefined
}

function readNumber(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return undefined
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
    photo: mapClientPhoto(payload),
    currentMembership: mapClientCurrentMembership(payload),
    membershipHistory: mapClientMembershipHistory(payload),
  }
}

function mapClientPhoto(payload: ClientResponsePayload): ClientPhoto | null {
  const nestedPayload = extractRecordPayload(payload, ['photo', 'Photo'])
  const flatPayload = payload as Record<string, unknown>
  const sourcePayload = nestedPayload ?? flatPayload
  const hasPhoto =
    readBoolean(sourcePayload, ['hasPhoto', 'HasPhoto']) ??
    readBoolean(flatPayload, ['hasPhoto', 'HasPhoto']) ??
    false
  const path =
    readString(sourcePayload, ['path', 'Path', 'photoPath', 'PhotoPath']) ??
    readString(flatPayload, ['photoPath', 'PhotoPath'])
  const contentType =
    readString(sourcePayload, [
      'contentType',
      'ContentType',
      'photoContentType',
      'PhotoContentType',
    ]) ?? readString(flatPayload, ['photoContentType', 'PhotoContentType'])
  const sizeBytes =
    readNumber(sourcePayload, [
      'sizeBytes',
      'SizeBytes',
      'photoSizeBytes',
      'PhotoSizeBytes',
    ]) ?? readNumber(flatPayload, ['photoSizeBytes', 'PhotoSizeBytes'])
  const uploadedAt =
    readString(sourcePayload, [
      'uploadedAt',
      'UploadedAt',
      'photoUploadedAt',
      'PhotoUploadedAt',
    ]) ?? readString(flatPayload, ['photoUploadedAt', 'PhotoUploadedAt'])

  if (!hasPhoto && !path && !contentType && sizeBytes === undefined && !uploadedAt) {
    return null
  }

  return {
    path: path ?? undefined,
    contentType: contentType ?? undefined,
    sizeBytes,
    uploadedAt: uploadedAt ?? undefined,
  }
}

function mapClientCurrentMembership(
  payload: ClientResponsePayload,
): ClientMembership | null {
  const membershipPayload = extractRecordPayload(payload, [
    'currentMembership',
    'CurrentMembership',
  ])

  return mapClientMembership(membershipPayload)
}

function mapClientMembershipHistory(
  payload: ClientResponsePayload,
): ClientMembership[] {
  return extractArrayPayload<ClientMembershipPayload>(
    payload,
    CLIENT_MEMBERSHIP_PAYLOAD_KEYS,
  )
    .map((membership) => mapClientMembership(membership))
    .filter((membership): membership is ClientMembership => membership !== null)
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

function mapClientMembership(payload: unknown): ClientMembership | null {
  if (!isRecord(payload)) {
    return null
  }

  const membershipType = mapMembershipType(
    readString(payload, ['membershipType', 'MembershipType']),
  )
  const purchaseDate =
    readString(payload, ['purchaseDate', 'PurchaseDate']) ?? ''

  if (!membershipType || !purchaseDate) {
    return null
  }

  return {
    id:
      readString(payload, ['id', 'Id']) ??
      `${membershipType}-${purchaseDate}-${readString(payload, ['validFrom', 'ValidFrom']) ?? 'current'}`,
    membershipType,
    purchaseDate,
    expirationDate:
      readString(payload, ['expirationDate', 'ExpirationDate']) ?? null,
    paymentAmount:
      readNumber(payload, ['paymentAmount', 'PaymentAmount']) ?? 0,
    isPaid: readBoolean(payload, ['isPaid', 'IsPaid']) ?? false,
    singleVisitUsed:
      readBoolean(payload, ['singleVisitUsed', 'SingleVisitUsed']) ?? false,
    changeReason:
      readString(payload, ['changeReason', 'ChangeReason']) ?? undefined,
    paidAt: readString(payload, ['paidAt', 'PaidAt']) ?? undefined,
    paidByUserId:
      readString(payload, ['paidByUserId', 'PaidByUserId']) ?? undefined,
    paidByUserName:
      readString(payload, [
        'paidByUserName',
        'PaidByUserName',
        'paidByFullName',
        'PaidByFullName',
      ]) ?? undefined,
    changedByUserId:
      readString(payload, ['changedByUserId', 'ChangedByUserId']) ?? undefined,
    changedByUserName:
      readString(payload, [
        'changedByUserName',
        'ChangedByUserName',
        'changedByFullName',
        'ChangedByFullName',
      ]) ?? undefined,
    validFrom: readString(payload, ['validFrom', 'ValidFrom']) ?? undefined,
    validTo:
      readString(payload, ['validTo', 'ValidTo']) ??
      (hasProperty(payload, ['validTo', 'ValidTo']) ? null : undefined),
    createdAt: readString(payload, ['createdAt', 'CreatedAt']) ?? undefined,
  }
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

function mapMembershipType(type?: string | null): MembershipType | null {
  if (type === 'SingleVisit' || type === 'Monthly' || type === 'Yearly') {
    return type
  }

  return null
}
