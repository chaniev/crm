export type AppSection =
  | 'Home'
  | 'Schedule'
  | 'Clients'
  | 'Groups'
  | 'Users'
  | 'Audit'
  | 'Finance'
  | 'Settings'

export type AccessPermissions = {
  canManageUsers: boolean
  canManageClients: boolean
  canManageGroups: boolean
  canManageSettings: boolean
  canMarkAttendance: boolean
  canViewAuditLog: boolean
  canViewFinancialReports: boolean
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
  bootstrapMode: boolean
}

export type AppConfigResponse = {
  clubName: string
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
export type MessengerPlatform = 'Telegram'

export type UserListItem = {
  id: string
  fullName: string
  login: string
  role: UserRole
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
}

export type UserDetails = UserListItem

export type CreateUserRequest = {
  fullName: string
  login: string
  password: string
  role: UserRole
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
}

export type UpdateUserRequest = {
  fullName: string
  login: string
  role: UserRole
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
}

export type GroupTrainerSummary = {
  id: string
  fullName: string
  login?: string
}

export type AttendanceGroup = {
  id: string
  name: string
  trainingStartTime?: string
  durationMinutes?: number
  weekdays?: number[]
  clientCount?: number
}

export type ClientStatus = 'Active' | 'Archived'
export type ClientPaymentStatus = 'Paid' | 'Unpaid'
export type ClientMembershipState =
  | 'None'
  | 'ActivePaid'
  | 'Unpaid'
  | 'Expired'
  | 'UsedSingleVisit'
export type ClientQuickFilter =
  | 'WithoutMembership'
  | 'ExpiringSoon'
  | 'WithoutGroup'
  | 'Trial'

export type ClientQuickFilterCounts = {
  withoutMembership: number
  expiringSoon: number
  withoutGroup: number
  trial: number
}

export type ClientActionHint = {
  title: string
  description: string
  tone: string
  iconKey: string
  daysUntilExpiration: number | null
}

export type ClientMessengerConnectionStatus =
  | 'NotConnected'
  | 'PendingLink'
  | 'Connected'

export type ClientMessengerMessageDirection = 'Inbound' | 'Outbound'
export type ClientMessengerMessageStatus =
  | 'Received'
  | 'Queued'
  | 'Sending'
  | 'SentToTelegram'
  | 'Failed'

export type ClientMessengerCapabilities = {
  visible: boolean
  canRead: boolean
  canReply: boolean
  canCreateLink: boolean
  canShowQr: boolean
}

export type ClientMessengerConnection = {
  status: ClientMessengerConnectionStatus
  linkedAt: string | null
  telegramUsername: string | null
  telegramDisplayName: string | null
  pendingLinkExpiresAt: string | null
}

export type ClientMessengerLatestMessage = {
  id: string
  direction: ClientMessengerMessageDirection
  status: ClientMessengerMessageStatus
  text: string
  createdAt: string
}

export type ClientMessengerSummary = {
  platform: MessengerPlatform
  capabilities: ClientMessengerCapabilities
  connection: ClientMessengerConnection
  unreadCount: number
  totalMessageCount: number
  latestMessageAt: string | null
  latestMessage: ClientMessengerLatestMessage | null
}

export type ClientMessengerMessage = {
  id: string
  direction: ClientMessengerMessageDirection
  status: ClientMessengerMessageStatus
  text: string
  createdAt: string
  updatedAt: string
  sentAt: string | null
  failedAt: string | null
  failureReason: string | null
  createdByUserName: string | null
  telegramUsername: string | null
  telegramDisplayName: string | null
}

export type ClientMessengerMessagePage = {
  platform: MessengerPlatform
  items: ClientMessengerMessage[]
  skip: number
  take: number
  totalCount: number
  hasMore: boolean
}

export type ClientMessengerLinkToken = {
  platform: MessengerPlatform
  deepLinkUrl: string
  qrCodeSvg: string
  expiresAt: string
  connection: ClientMessengerConnection
}

export type ClientMessengerReadState = {
  platform: MessengerPlatform
  lastReadAt: string
  unreadCount: number
}

export type ClientContact = {
  id?: string
  type: string
  fullName: string
  phone: string
}

export type ClientGroupSummary = {
  id: string
  name: string
  branchId?: string
  branchName?: string
  hallId?: string
  hallName?: string
  isActive: boolean
  trainingStartTime?: string
  durationMinutes?: number
  weekdays?: number[]
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

export type ClientAttendanceHistoryEntry = {
  id: string
  groupId?: string
  groupName: string
  trainingDate: string
  isPresent: boolean
}

export type ClientListItem = {
  id: string
  fullName: string
  lastName: string
  firstName: string
  middleName: string
  phone: string
  branchId: string
  branchName: string
  status: ClientStatus
  contactCount: number
  groupCount: number
  groups: ClientGroupSummary[]
  photo: ClientPhoto | null
  isProfessional: boolean
  professionalComment: string | null
  hasActivePaidMembership: boolean
  hasUnpaidCurrentMembership: boolean
  membershipWarning: boolean
  membershipWarningMessage?: string
  currentMembership: ClientMembership | null
  currentMembershipSummary: ClientMembershipSummary | null
  hasCurrentMembership: boolean
  membershipState: ClientMembershipState
  actionHints: ClientActionHint[]
  lastVisitDate?: string | null
  updatedAt?: string
}

export type ClientMembershipSummary = Pick<
  ClientMembership,
  | 'id'
  | 'membershipType'
  | 'purchaseDate'
  | 'expirationDate'
  | 'isPaid'
  | 'singleVisitUsed'
>

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

export type ExpiringClientMembership = {
  clientId: string
  fullName: string
  membershipType: MembershipType
  expirationDate: string
  daysUntilExpiration: number
  isPaid: boolean
}

export type AttendanceClient = {
  id: string
  fullName: string
  groups: ClientGroupSummary[]
  photo: ClientPhoto | null
  isPresent: boolean
  isProfessional: boolean
  professionalComment: string | null
  hasActivePaidMembership: boolean
  hasUnpaidCurrentMembership: boolean
  membershipWarning: boolean
  membershipWarningMessage?: string
  currentMembership: ClientMembership | null
}

export type AttendanceRosterResponse = {
  groupId: string
  trainingDate: string
  clients: AttendanceClient[]
}

export type SaveAttendanceMarksRequest = {
  trainingDate: string
  attendanceMarks: Array<{
    clientId: string
    isPresent: boolean
  }>
}

export type ClientDetails = ClientListItem & {
  createdAt?: string
  contacts: ClientContact[]
  groupIds: string[]
  notes: string
  photo: ClientPhoto | null
  currentMembership: ClientMembership | null
  membershipHistory: ClientMembership[]
  attendanceHistory: ClientAttendanceHistoryEntry[]
  attendanceHistoryLoaded: boolean
  attendanceHistoryTotalCount: number | null
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
  branchId?: string
  notes?: string
  contacts: ClientContactInput[]
  groupIds: string[]
}

export type TransferClientBranchRequest = {
  branchId?: string
  groupId?: string | null
}

export type Branch = {
  id: string
  name: string
  address: string | null
  description: string | null
  isArchived: boolean
  hallCount: number
  groupCount: number
  clientCount: number
  createdAt?: string
  updatedAt?: string
}

export type Hall = {
  id: string
  branchId: string
  branchName: string
  name: string
  description: string | null
  isArchived: boolean
  groupCount: number
  createdAt?: string
  updatedAt?: string
}

export type UpsertBranchRequest = {
  name: string
  address?: string | null
  description?: string | null
}

export type UpsertHallRequest = {
  branchId?: string
  name: string
  description?: string | null
}

export type GroupType = {
  id: string
  name: string
  description: string | null
  groupCount: number
  createdAt?: string
  updatedAt?: string
}

export type UpsertGroupTypeRequest = {
  name: string
  description?: string | null
}

export type CreateAdministratorRequest = {
  fullName: string
  login: string
  password: string
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
}

export type UpdateAdministratorRequest = {
  fullName: string
  login: string
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
}

export type UpdateClientProfessionalStatusRequest = {
  isProfessional: boolean
  professionalComment?: string | null
}

export type GetClientsParams = {
  page?: number
  pageSize?: number
  skip?: number
  take?: number
  query?: string
  search?: string
  fullName?: string
  phone?: string
  groupId?: string
  status?: ClientStatus
  paymentStatus?: ClientPaymentStatus
  membershipState?: ClientMembershipState
  membershipType?: MembershipType
  membershipExpiresFrom?: string
  membershipExpiresTo?: string
  hasPhoto?: boolean
  hasGroup?: boolean
  hasCurrentMembership?: boolean
  hasActivePaidMembership?: boolean
  quickFilters?: ClientQuickFilter[]
}

export type ClientListResponse = {
  items: ClientListItem[]
  totalCount: number | null
  activeCount: number | null
  archivedCount: number | null
  quickFilterCounts: ClientQuickFilterCounts | null
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

export type AuditLogEntry = {
  id: string
  userId?: string
  userName: string
  userLogin?: string
  userRole?: UserRole
  source?: string
  messengerPlatform?: MessengerPlatform | string
  actionType: string
  entityType: string
  entityId?: string
  description: string
  oldValueJson: unknown | null
  newValueJson: unknown | null
  createdAt: string
}

export type GetAuditLogParams = {
  page?: number
  pageSize?: number
  skip?: number
  take?: number
  userId?: string | null
  source?: string | null
  messengerPlatform?: string | null
  actionType?: string
  entityType?: string
  dateFrom?: string
  dateTo?: string
}

export type AuditLogListResponse = {
  items: AuditLogEntry[]
  totalCount: number | null
  skip: number
  take: number
  page: number
  pageSize: number
  hasNextPage: boolean
}

export type AuditLogFilterUser = {
  id: string
  fullName: string
  login: string
  role: UserRole
}

export type AuditLogFilterOptions = {
  users: AuditLogFilterUser[]
  actionTypes: string[]
  entityTypes: string[]
  sources: string[]
  messengerPlatforms: string[]
}

export type FinancialReportPeriodPreset = 'month' | 'quarter' | 'year' | 'custom'

export type GetFinancialReportParams = {
  periodPreset: FinancialReportPeriodPreset
  anchorDate?: string
  from?: string
  to?: string
  branchId?: string | null
  trainerId?: string | null
}

export type FinancialReportPeriod = {
  preset: FinancialReportPeriodPreset
  anchorDate: string | null
  from: string
  to: string
}

export type FinancialReportTotals = {
  soldMembershipCount: number
  grossSales: number
  refundTotal: number
  netTotal: number
  newClientsCount: number
}

export type FinancialReportBranchBreakdownRow = FinancialReportTotals & {
  branchId: string
  branchName: string
}

export type FinancialReportGroupBreakdownRow = FinancialReportTotals & {
  groupId: string
  groupName: string
  branchId: string
  branchName: string
}

export type FinancialReportTrainerBreakdownRow = FinancialReportTotals & {
  trainerId: string
  trainerName: string
}

export type FinancialReportResponse = {
  period: FinancialReportPeriod
  totals: FinancialReportTotals
  branchBreakdown: FinancialReportBranchBreakdownRow[]
  groupBreakdown: FinancialReportGroupBreakdownRow[]
  trainerBreakdown: FinancialReportTrainerBreakdownRow[]
}

export type TrainingGroupListItem = {
  id: string
  name: string
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  groupTypeId: string
  groupTypeName: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
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
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  groupTypeId: string
  groupTypeName: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
  isActive: boolean
  trainerIds: string[]
  trainers: GroupTrainerSummary[]
  clientCount: number
  updatedAt?: string
  createdAt?: string
}

export type UpsertTrainingGroupRequest = {
  name: string
  branchId?: string
  hallId?: string
  groupTypeId?: string
  trainingStartTime: string
  durationMinutes: number | null
  weekdays: number[]
  isActive: boolean
  trainerIds: string[]
}

export type GroupResponsePayload = {
  id: string
  name: string
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  groupTypeId: string
  groupTypeName: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
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

export type GroupsListEnvelopePayload = {
  items: GroupResponsePayload[]
  totalCount?: number
  skip?: number
  take?: number
}

export type GroupClientResponsePayload = {
  id: string
  fullName: string
  status: string
  phone?: string
}

export type GroupTrainerOptionPayload = {
  id: string
  fullName: string
  login: string
}

export type UserResponsePayload = Record<string, unknown>

export type AttendanceGroupPayload = {
  id?: string | null
  groupId?: string | null
  name?: string | null
  groupName?: string | null
  trainingStartTime?: string | null
  durationMinutes?: number | null
  weekdays?: number[] | null
  clientCount?: number | null
}

export type AttendanceClientPayload = Record<string, unknown>
export type AuditLogEntryPayload = Record<string, unknown>
export type AuditLogFilterOptionsPayload = Record<string, unknown>

export type ClientContactPayload = {
  id?: string
  type?: string | null
  fullName?: string | null
  phone?: string | null
}

export type ClientGroupPayload = {
  id: string
  name?: string | null
  groupName?: string | null
  title?: string | null
  branchId?: string | null
  branchName?: string | null
  hallId?: string | null
  hallName?: string | null
  isActive?: boolean | null
  trainingStartTime?: string | null
  durationMinutes?: number | null
  weekdays?: number[] | null
}

export type ClientResponsePayload = {
  id: string
  lastName?: string | null
  firstName?: string | null
  middleName?: string | null
  fullName?: string | null
  phone?: string | null
  branchId?: string | null
  branchName?: string | null
  notes?: string | null
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
  isProfessional?: boolean | null
  professionalComment?: string | null
  currentMembership?: Record<string, unknown> | null
  currentMembershipSummary?: Record<string, unknown> | null
  hasCurrentMembership?: boolean | null
  membershipState?: string | null
  actionHints?: unknown[] | Record<string, unknown>
  lastVisitDate?: string | null
  updatedAt?: string
  createdAt?: string
}

export type ClientMembershipPayload = Record<string, unknown>
export type ClientAttendanceHistoryPayload = Record<string, unknown>
