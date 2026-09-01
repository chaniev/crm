export type AppSection =
  | 'Attendance'
  | 'Attention'
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
  role: 'HeadCoach' | 'SuperAdministrator' | 'Administrator' | 'Coach'
  mustChangePassword: boolean
  isActive: boolean
  landingScreen: AppSection
  allowedSections: AppSection[]
  permissions: AccessPermissions
  assignedGroupIds: string[]
  attendanceScope: AttendanceScope
  branchId: string | null
  createRoleOptions?: UserRole[]
}

export type SessionResponse = {
  isAuthenticated: boolean
  csrfToken: string
  user: AuthenticatedUser | null
  bootstrapMode: boolean
}

export type AppConfigResponse = {
  clubName: string
  themeId: string
  authBackgroundImageId: string
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
export type AdministrativeUserRole = Extract<
  UserRole,
  'Administrator' | 'SuperAdministrator'
>
export type MessengerPlatform = 'Telegram'
export type UserAllowedAction =
  | 'Read'
  | 'Edit'
  | 'Update'
  | 'Deactivate'
  | 'Reactivate'
  | 'Delete'
  | 'ManageAttendanceScope'

export type UserListItem = {
  id: string
  fullName: string
  login: string
  role: UserRole
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
  branchId: string | null
  branchName: string | null
  attendanceGroupGrantCount?: number
  allowedActions?: UserAllowedAction[]
  roleOptions?: UserRole[]
}

export type UserDetails = UserListItem

export type UserListResponse = {
  items: UserListItem[]
  createRoleOptions: UserRole[]
}

export type CreateUserRequest = {
  fullName: string
  login: string
  password: string
  role: UserRole
  branchId: string | null
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
}

export type UpdateUserRequest = {
  fullName: string
  login: string
  role: UserRole
  branchId: string | null
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

export type AttendanceScopeKind =
  | 'Global'
  | 'TrainerAssignments'
  | 'AdministratorGrants'

export type AttendanceScope = {
  kind: AttendanceScopeKind
  groupIds: string[]
}

export type AttendanceState = 'Unmarked' | 'Present' | 'Absent'

export type AttendanceGroupsResponse = {
  groups: AttendanceGroup[]
  today: string
  minTrainingDate: string | null
  maxTrainingDate: string
}

export type AttendanceTodayTrainer = {
  trainerId: string
  fullName: string
  kind: 'Permanent' | 'Substitute'
}

export type AttendanceTodayLesson = {
  lessonOccurrenceId: string
  lessonDate: string
  groupId: string
  groupName: string
  startTime: string
  endTime: string
  branchName: string
  hallName: string
  effectiveTrainers: AttendanceTodayTrainer[]
  openAttendance: ScheduleAction
  unmarkedClientCount: number
}

export type AttendanceTodayLessonsResponse = {
  today: string
  items: AttendanceTodayLesson[]
  partial: boolean
}

export type AdministratorAttendanceScopeGroup = {
  id: string
  name: string
  trainingStartTime?: string
  durationMinutes?: number
  weekdays?: number[]
  isActive: boolean
  isGranted: boolean
  canGrant: boolean
  canRevoke: boolean
  disabledReason: string | null
}

export type AdministratorUnavailableAttendanceGrant = {
  groupId: string
  branchId?: string | null
  isGranted: true
  canGrant: false
  canRevoke: boolean
  disabledReason: string
}

export type AdministratorAttendanceScopeResponse = {
  administrator: {
    id: string
    fullName: string
    isActive: boolean
  }
  branch: {
    id: string
    name: string
    isArchived: boolean
  } | null
  grantedGroupIds: string[]
  groups: AdministratorAttendanceScopeGroup[]
  unavailableGrants: AdministratorUnavailableAttendanceGrant[]
}

export type ReplaceAdministratorAttendanceScopeRequest = {
  expectedGroupIds: string[]
  groupIds: string[]
}

export type ClientStatus = 'Active' | 'Archived'
export type ClientMembershipState =
  | 'None'
  | 'Active'
  | 'Future'
  | 'Expired'
  | 'UsedSingleVisit'
  | 'LegacyTargetMissing'
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

export type MembershipBehaviorKind = 'SingleVisit' | 'Term' | 'Professional'
export type MembershipSalePricingMode =
  | 'Catalog'
  | 'CatalogOverride'
  | 'AmountOnly'

export type MembershipCatalogItem = {
  id: string
  branchId: string | null
  name: string
  price: number
  behaviorKind: MembershipBehaviorKind
  availableFrom: string
  availableTo: string | null
  isSystemOwned: boolean
}

export type CreateMembershipCatalogItemRequest = {
  branchId: string
  name: string
  price: number
  behaviorKind: Exclude<MembershipBehaviorKind, 'Professional'>
  availableFrom: string
  availableTo: string | null
}

export type UpdateMembershipCatalogItemRequest = Pick<
  MembershipCatalogItem,
  'name' | 'availableFrom' | 'availableTo'
>

export type ClientMembershipChangeReason =
  | 'NewPurchase'
  | 'Renewal'
  | 'Correction'
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
  hasActiveMembership: boolean
  membershipWarning: boolean
  membershipWarningMessage?: string
  currentMemberships: ClientMembership[]
  hasCurrentMembership: boolean
  membershipState: ClientMembershipState
  actionHints: ClientActionHint[]
  lastVisitDate?: string | null
  updatedAt?: string
}

export type ClientMembership = {
  id: string
  saleId: string
  membershipCatalogItemId: string | null
  membershipName: string
  behaviorKind: MembershipBehaviorKind
  purchaseDate: string
  paymentDate: string
  expirationDate: string | null
  pricingMode: MembershipSalePricingMode
  grossAmount: number
  catalogPrice: number | null
  singleVisitUsed: boolean
  coverageKind: ClientMembershipCoverageKind
  entitlementState: ClientMembershipEntitlementState
  targetGroups: ClientMembershipTargetGroup[]
  changeReason?: ClientMembershipChangeReason | string
  paymentRecordedAt: string
  paymentRecordedByUserId: string
  paymentRecordedByUserName: string
  changedByUserId?: string
  changedByUserName?: string
  validFrom?: string
  validTo?: string | null
  createdAt?: string
  professionalComment?: string | null
  comment: string | null
  commentLastChangedByName: string | null
  commentLastChangedAt: string | null
}

export type ClientMembershipCoverageKind = 'TargetGroups' | 'AllGroups'

export type ClientMembershipEntitlementState =
  | 'Active'
  | 'Future'
  | 'Expired'
  | 'UsedSingleVisit'
  | 'LegacyTargetMissing'

export type ClientMembershipTargetGroup = {
  groupId: string
  groupName: string
  branchId: string
  branchName: string
  position: number
  isActive: boolean
}

export type MembershipAttentionState =
  | 'Expired'
  | 'ExpiringSoon'
  | 'Unknown'

export type MembershipAttentionItem = {
  clientId: string
  fullName: string
  membershipId: string
  saleId: string
  behaviorKind: MembershipBehaviorKind
  membershipName: string
  expirationDate: string | null
  daysUntilExpiration: number | null
  targetGroups: ClientMembershipTargetGroup[]
  targetSummary: string
  state: MembershipAttentionState
}

export type ExpiringClientMembership = MembershipAttentionItem

export type ClientAttentionMembershipReason = {
  type: 'expiredMembership' | 'expiringMembership'
  membershipId: string
  saleId: string
  expirationDate: string | null
  daysUntilExpiration: number | null
  targetGroups: ClientMembershipTargetGroup[]
  targetSummary: string
}

export type ClientAttentionMissedTrainingReason = {
  type: 'missedTraining'
  missedCount: number
}

export type ClientAttentionReason =
  | ClientAttentionMembershipReason
  | ClientAttentionMissedTrainingReason

export type ClientAttentionMembershipSummary = {
  membershipId: string
  saleId: string
  behaviorKind: MembershipBehaviorKind
  membershipName: string
  expirationDate: string | null
  daysUntilExpiration: number | null
  targetGroups: ClientMembershipTargetGroup[]
  targetSummary: string
}

export type ClientAttentionItem = {
  clientId: string
  fullName: string
  phone: string | null
  notes: string | null
  membership: ClientAttentionMembershipSummary | null
  telegramLink: string | null
  reasons: ClientAttentionReason[]
}

export type AttendanceClient = {
  id: string
  fullName: string
  groups: ClientGroupSummary[]
  photo: ClientPhoto | null
  state: AttendanceState
  isProfessional: boolean
  professionalComment: string | null
  hasActiveMembership: boolean
  membershipWarning: boolean
  membershipWarningMessage?: string
  currentMemberships: ClientMembership[]
}

export type AttendanceRosterResponse = {
  groupId: string
  trainingDate: string
  lessonOccurrenceId?: string
  lessonDate?: string
  canEditAttendance?: ScheduleAction
  today: string
  minTrainingDate: string | null
  maxTrainingDate: string
  clients: AttendanceClient[]
}

export type SaveAttendanceMarksRequest = {
  trainingDate: string
  lessonDate?: string
  attendanceMarks: Array<{
    clientId: string
    state: AttendanceState
  }>
}

export type SaveAttendanceMarksResponse = {
  groupId: string
  trainingDate: string
  lessonOccurrenceId?: string
  lessonDate?: string
  today: string
  minTrainingDate: string | null
  maxTrainingDate: string
  attendanceMarks: Array<{
    clientId: string
    state: AttendanceState
  }>
}

export type ClientDetails = ClientListItem & {
  createdAt?: string
  birthDate: string | null
  businessDate: string
  contacts: ClientContact[]
  groupIds: string[]
  notes: string
  notesLastChangedByName: string | null
  notesLastChangedAt: string | null
  photo: ClientPhoto | null
  currentMemberships: ClientMembership[]
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
  birthDate: string | null
  branchId?: string
  notes?: string
  contacts: ClientContactInput[]
  groupIds: string[]
}

export type TransferClientBranchRequest = {
  targetBranchId: string
  targetGroupIds: string[]
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
  role: AdministrativeUserRole
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
  branchId: string | null
}

export type UpdateAdministratorRequest = {
  fullName: string
  login: string
  role: AdministrativeUserRole
  mustChangePassword: boolean
  isActive: boolean
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string | null
  branchId: string | null
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
  membershipState?: ClientMembershipState
  behaviorKind?: MembershipBehaviorKind
  membershipExpiresFrom?: string
  membershipExpiresTo?: string
  hasPhoto?: boolean
  hasGroup?: boolean
  hasCurrentMembership?: boolean
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
  membershipCatalogItemId?: string | null
  manualSaleAmount?: number | null
  validFrom?: string
  validTo?: string
  paymentDate: string
  targetGroupIds: string[]
  professionalComment?: string
}

export type CorrectClientMembershipRequest = {
  saleId: string
  expectedMembershipId: string
  validFrom: string
  validTo?: string
  paymentDate: string
  targetGroupIds: string[]
}

export type MembershipWriteRequestOptions = {
  idempotencyKey: string
}

export type MembershipExpirationSuggestion = {
  behaviorKind: MembershipBehaviorKind
  startDate: string
  expirationDate: string | null
}

export type RenewClientMembershipRequest = {
  saleId: string
  expectedMembershipId: string
  membershipCatalogItemId?: string | null
  manualSaleAmount?: number | null
  paymentDate: string
  targetGroupIds: string[]
  professionalComment?: string
}

export type MembershipTargetTransferRequest = {
  sourceGroupId: string
  targetGroupId: string
  expectedMembershipIds: string[]
}

export type MembershipTargetTransferPreviewMembership = {
  membershipId: string
  saleId: string
  membershipName: string
  beforeTargetGroups: ClientMembershipTargetGroup[]
  afterTargetGroups: ClientMembershipTargetGroup[]
}

export type MembershipTargetTransferPreview = {
  affectedMemberships: MembershipTargetTransferPreviewMembership[]
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

export type GroupTrainerSubstitutionStatus =
  | 'Upcoming'
  | 'Active'
  | 'Expired'
  | 'Cancelled'

export type GroupTrainerSubstitutionAllowedActions = {
  canEdit: boolean
  canCancel: boolean
}

export type GroupTrainerSubstitute = {
  id: string
  fullName: string
  login: string
  isActive: boolean
}

export type GroupTrainerSubstitution = {
  id: string
  groupId: string
  substituteTrainer: GroupTrainerSubstitute
  startsOn: string
  endsOn: string
  status: GroupTrainerSubstitutionStatus
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  allowedActions: GroupTrainerSubstitutionAllowedActions
}

export type GroupTrainerSubstitutionHistoryPage = {
  items: GroupTrainerSubstitution[]
  totalCount: number
  skip: number
  take: number
}

export type GroupTrainerSubstitutionCreateUnavailableReason = {
  code: string
  message: string
}

export type GroupTrainerSubstitutionsResponse = {
  current: GroupTrainerSubstitution[]
  history: GroupTrainerSubstitutionHistoryPage
  canCreate: boolean
  createUnavailableReason: GroupTrainerSubstitutionCreateUnavailableReason | null
}

export type GetGroupTrainerSubstitutionsParams = {
  historySkip?: number
  historyTake?: number
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

export type ScheduleAction = {
  allowed: boolean
  reason: string | null
}

export type ScheduleLessonAllowedActions = {
  viewAttendance: ScheduleAction
  editAttendance: ScheduleAction
  edit: ScheduleAction
  move: ScheduleAction
  cancel: ScheduleAction
  restore: ScheduleAction
  assignTrainerSubstitution: ScheduleAction
  cancelTrainerSubstitution: ScheduleAction
}

export type ScheduleLessonTrainer = {
  trainerId: string
  fullName: string
  kind: 'Permanent' | 'Substitute'
  replacedTrainerId: string | null
  substitutionId: string | null
}

export type ScheduleLesson = {
  lessonOccurrenceId: string
  sourceKind: 'Recurring' | 'OneOff' | 'LegacyAttendance'
  isMaterialized: boolean
  lessonSeriesId: string | null
  lessonDate: string
  startTime: string
  durationMinutes: number
  endTime: string
  groupId: string
  groupName: string
  groupTypeId: string
  groupTypeName: string
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  effectiveTrainers: ScheduleLessonTrainer[]
  status: 'Scheduled' | 'Cancelled'
  hasAttendanceMarks: boolean
  allowedActions: ScheduleLessonAllowedActions
  revision: string
}

export type ScheduleLessonsResponse = {
  from: string
  to: string
  items: ScheduleLesson[]
  capabilities: {
    createOneOff: ScheduleAction
  }
  filterOptions: {
    branches: Array<{ id: string; name: string }>
    halls: Array<{ id: string; name: string }>
    trainers: Array<{ id: string; name: string }>
    groups: Array<{ id: string; name: string }>
    groupTypes: Array<{ id: string; name: string }>
  }
}

export type ScheduleOneOffLessonRequest = {
  groupId: string | null
  lessonDate: string
  startTime: string
  durationMinutes: number | null
  hallId: string | null
}

export type ScheduleOneOffLessonExecuteRequest = ScheduleOneOffLessonRequest & {
  confirmationToken: string
}

export type ScheduleWarning = {
  code: string
  message: string
}

export type ScheduleOneOffLessonPreviewResponse = {
  confirmationToken: string
  expiresAt: string
  lesson: ScheduleLesson
  warnings: ScheduleWarning[]
}

export type ScheduleLessonChangeRequest = {
  scope: 'Occurrence' | 'ThisAndFuture' | 'EntireSeries'
  newLessonDate: string
  startTime: string
  durationMinutes: number | null
  hallId: string | null
  expectedRevision: string
}

export type ScheduleLessonChangeExecuteRequest = ScheduleLessonChangeRequest & {
  confirmationToken: string
}

export type ScheduleLessonChangePreviewResponse = {
  confirmationToken: string
  expiresAt: string
  lesson: ScheduleLesson
  warnings: ScheduleWarning[]
  impact: ScheduleLessonChangeImpact
}

export type ScheduleLessonChangeImpact = {
  scope: 'Occurrence' | 'ThisAndFuture' | 'EntireSeries'
  startsOn: string
  affectsFutureProjection: boolean
  skipped: ScheduleLessonChangeSkippedOccurrence[]
}

export type ScheduleLessonChangeSkippedOccurrence = {
  lessonOccurrenceId: string
  lessonDate: string
  reason: string
}

export type ScheduleLessonCancellationAction = 'Cancel' | 'Restore'

export type ScheduleLessonCancellationRequest = {
  action: ScheduleLessonCancellationAction
  expectedRevision: string
}

export type ScheduleLessonCancellationExecuteRequest = ScheduleLessonCancellationRequest & {
  confirmationToken: string
}

export type ScheduleLessonCancellationPreviewResponse = {
  confirmationToken: string
  expiresAt: string
  action: ScheduleLessonCancellationAction
  lesson: ScheduleLesson
}

export type GroupLessonSeriesScope = 'ThisAndFuture' | 'EntireSeries'

export type GroupLessonSeriesSlotRequest = {
  isoWeekday: number
  startTime: string
  durationMinutes: number | null
  hallId: string | null
}

export type GroupLessonSeriesRequest = {
  scope: GroupLessonSeriesScope
  effectiveFrom: string | null
  endsOn: string | null
  slots: GroupLessonSeriesSlotRequest[]
  expectedRevision: string | null
}

export type GroupLessonSeriesExecuteRequest = GroupLessonSeriesRequest & {
  confirmationToken: string
}

export type GroupLessonSeriesSlot = {
  isoWeekday: number
  startTime: string
  durationMinutes: number
  hallId: string
  hallName: string
}

export type GroupLessonSeriesAffectedOccurrence = {
  lessonOccurrenceId: string
  lessonDate: string
  startTime: string
  hallId: string
  hallName: string
}

export type GroupLessonSeriesSkippedOccurrence = {
  lessonOccurrenceId: string
  lessonDate: string
  reason: string
}

export type GroupLessonSeriesImpact = {
  totalAffectedOccurrences: number
  examples: GroupLessonSeriesAffectedOccurrence[]
  skipped: GroupLessonSeriesSkippedOccurrence[]
}

export type GroupLessonSeriesPreviewResponse = {
  confirmationToken: string
  expiresAt: string
  revision: string
  scope: GroupLessonSeriesScope
  effectiveFrom: string
  endsOn: string | null
  slots: GroupLessonSeriesSlot[]
  impact: GroupLessonSeriesImpact
  warnings: ScheduleWarning[]
}

export type GroupLessonSeriesExecuteResponse = {
  revision: string
  scope: GroupLessonSeriesScope
  effectiveFrom: string
  endsOn: string | null
  slots: GroupLessonSeriesSlot[]
  impact: GroupLessonSeriesImpact
  warnings: ScheduleWarning[]
}

export type GroupLessonSeriesReadResponse = {
  seriesId: string
  groupId: string
  groupName: string
  businessDate: string
  startsOn: string
  endsOn: string | null
  revision: string
  currentVersion: {
    versionNumber: number
    effectiveFrom: string
    effectiveTo: string | null
    thisAndFutureMinEffectiveFrom: string
    entireSeriesEffectiveFrom: string
    slots: GroupLessonSeriesSlot[]
  }
}

export type ScheduleLessonTrainerSubstitutionTargetRequest = {
  lessonOccurrenceId: string
  lessonDate: string
  expectedRevision: string
}

export type ScheduleLessonTrainerSubstitutionRequest = {
  replacedTrainerId: string | null
  substituteTrainerId: string | null
  targets: ScheduleLessonTrainerSubstitutionTargetRequest[]
}

export type ScheduleLessonTrainerSubstitutionExecuteRequest =
  ScheduleLessonTrainerSubstitutionRequest & {
    confirmationToken: string
  }

export type ScheduleLessonTrainerSubstitutionCancellationTargetRequest = {
  lessonOccurrenceId: string
  lessonDate: string
  substitutionId: string
  expectedRevision: string
}

export type ScheduleLessonTrainerSubstitutionCancellationRequest = {
  targets: ScheduleLessonTrainerSubstitutionCancellationTargetRequest[]
  reason: string | null
}

export type ScheduleLessonTrainerSubstitutionCancellationExecuteRequest =
  ScheduleLessonTrainerSubstitutionCancellationRequest & {
    confirmationToken: string
  }

export type ScheduleLessonTrainerSubstitutionTargetResponse = {
  lessonOccurrenceId: string
  lessonDate: string
  groupId: string
  groupName: string
  substitutionId: string | null
  warnings: ScheduleWarning[]
}

export type ScheduleLessonTrainerSubstitutionPreviewResponse = {
  confirmationToken: string
  expiresAt: string
  targets: ScheduleLessonTrainerSubstitutionTargetResponse[]
  warnings: ScheduleWarning[]
}

export type ScheduleLessonTrainerSubstitutionExecuteResponse = {
  lessons: ScheduleLesson[]
  warnings: ScheduleWarning[]
}

export type ScheduleLessonTrainerSubstitutionCancellationPreviewResponse = {
  confirmationToken: string
  expiresAt: string
  targets: ScheduleLessonTrainerSubstitutionTargetResponse[]
  warnings: ScheduleWarning[]
}

export type ScheduleLessonTrainerSubstitutionCancellationExecuteResponse = {
  lessons: ScheduleLesson[]
  warnings: ScheduleWarning[]
}

export type TrainingGroupSummary = {
  totalCount: number
  activeWithoutTrainerCount: number
}

export type GroupSummaryResponsePayload = {
  totalCount: number
  activeWithoutTrainerCount: number
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
  trainerAssignmentRevision: string
  trainerAssignmentPeriods: GroupTrainerAssignmentPeriod[]
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
  initialLessonSeries?: InitialLessonSeriesRequest
  confirmationToken?: string
}

export type UpdateTrainingGroupIdentityRequest = {
  name: string
  branchId?: string
  groupTypeId?: string
  isActive: boolean
}

export type InitialLessonSeriesRequest = {
  startsOn: string
  endsOn: string | null
  slots: InitialLessonSeriesSlotRequest[]
}

export type InitialLessonSeriesSlotRequest = {
  isoWeekday: number
  startTime: string
  durationMinutes: number | null
  hallId?: string
}

export type GroupPreviewResponse = {
  confirmationToken: string
  expiresAt: string
  warnings: ScheduleWarning[]
}

export type GroupTrainerAssignmentPeriod = {
  trainerId: string
  trainerName: string
  validFrom: string
  validTo: string | null
}

export type GroupTrainerAssignmentPeriodRequest = {
  trainerId: string | null
  validFrom: string
  validTo: string | null
}

export type GroupTrainerAssignmentsPreviewRequest = {
  assignments: GroupTrainerAssignmentPeriodRequest[]
  expectedRevision: string
}

export type GroupTrainerAssignmentsExecuteRequest = GroupTrainerAssignmentsPreviewRequest & {
  confirmationToken: string
}

export type GroupTrainerAssignmentImpact = {
  totalAffectedOccurrences: number
  examples: Array<{
    lessonOccurrenceId: string
    lessonDate: string
    startTime: string
    hallId: string
    hallName: string
  }>
}

export type GroupTrainerAssignmentsPreviewResponse = {
  confirmationToken: string
  expiresAt: string
  revision: string
  assignments: GroupTrainerAssignmentPeriod[]
  impact: GroupTrainerAssignmentImpact
  warnings: ScheduleWarning[]
}

export type GroupTrainerAssignmentsExecuteResponse = {
  revision: string
  assignments: GroupTrainerAssignmentPeriod[]
  impact: GroupTrainerAssignmentImpact
  warnings: ScheduleWarning[]
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
  trainerAssignmentRevision?: string
  trainerAssignmentPeriods?: GroupTrainerAssignmentPeriod[]
}

export type GroupsListEnvelopePayload = {
  items: GroupResponsePayload[]
  totalCount: number
  skip: number
  take: number
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
  birthDate?: string | null
  businessDate?: string | null
  notesLastChangedByName?: string | null
  notesLastChangedAt?: string | null
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
  currentMemberships?: unknown[] | null
  hasCurrentMembership?: boolean | null
  membershipState?: string | null
  actionHints?: unknown[] | Record<string, unknown>
  lastVisitDate?: string | null
  updatedAt?: string
  createdAt?: string
}

export type ClientMembershipPayload = Record<string, unknown>
export type ClientAttendanceHistoryPayload = Record<string, unknown>
