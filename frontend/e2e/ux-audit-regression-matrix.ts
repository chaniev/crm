export type UxAuditSurface =
  | 'attendance'
  | 'settings'
  | 'audit'
  | 'schedule'
  | 'profile'

export type UxAuditViewport =
  | '360x780'
  | '390x844'
  | '420x912'
  | '440x956'
  | '768x1024'
  | '912x420'
  | '956x440'
  | '1440x1200'
  | 'component-harness'

export type UxAuditCriterion =
  | 'accessible-semantics'
  | 'decision-data'
  | 'device-runtime'
  | 'focus-return'
  | 'page-overflow'
  | 'reachability'
  | 'role-access'
  | 'target-gap'
  | 'task-order'
  | 'touch-target'

export type UxAuditEvidenceKind =
  | 'component-test'
  | 'physical-device'
  | 'playwright-chromium'
  | 'playwright-webkit-emulation'

export type UxAuditAutomationStatus =
  | 'automated-pass'
  | 'dependency-pending'
  | 'manual-only'

export type UxAuditRegressionRequirement = {
  automationStatus: UxAuditAutomationStatus
  criteria: UxAuditCriterion[]
  evidenceKind: UxAuditEvidenceKind
  id: string
  mandatoryViewports: UxAuditViewport[]
  owningSpec: string
  roleProfileId: string
  surface: UxAuditSurface
  viewports: UxAuditViewport[]
}

const ATTENDANCE_CHROMIUM_VIEWPORTS: UxAuditViewport[] = [
  '390x844',
  '420x912',
  '440x956',
  '912x420',
  '956x440',
]

const SETTINGS_CHROMIUM_VIEWPORTS: UxAuditViewport[] = [
  '390x844',
  '420x912',
  '440x956',
  '912x420',
  '956x440',
]

const AUDIT_CHROMIUM_VIEWPORTS: UxAuditViewport[] = [
  '390x844',
  '420x912',
  '440x956',
  '912x420',
  '956x440',
]

const TARGET_IPHONE_VIEWPORTS: UxAuditViewport[] = ['420x912', '440x956']

const TOUCH_INVENTORY_VIEWPORTS: UxAuditViewport[] = [
  '360x780',
  '390x844',
  '420x912',
  '440x956',
  '768x1024',
  '1440x1200',
  '912x420',
  '956x440',
]

export const UX_AUDIT_REGRESSION_MATRIX: readonly UxAuditRegressionRequirement[] = [
  {
    id: 'attendance.touch-geometry.chromium',
    surface: 'attendance',
    roleProfileId: 'responsive-main-screens.spec.ts#COACH_SESSION/TASK_104_ATTENDANCE_VIEWPORTS',
    viewports: [...ATTENDANCE_CHROMIUM_VIEWPORTS],
    mandatoryViewports: [...ATTENDANCE_CHROMIUM_VIEWPORTS],
    criteria: ['touch-target', 'target-gap', 'reachability'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/responsive-main-screens.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'attendance.page-overflow.chromium',
    surface: 'attendance',
    roleProfileId: 'responsive-main-screens.spec.ts#COACH_SESSION/TASK_104_ATTENDANCE_VIEWPORTS',
    viewports: [...ATTENDANCE_CHROMIUM_VIEWPORTS],
    mandatoryViewports: [...ATTENDANCE_CHROMIUM_VIEWPORTS],
    criteria: ['page-overflow'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/responsive-main-screens.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'attendance.target-iphone.webkit',
    surface: 'attendance',
    roleProfileId: 'iphone-target-devices.spec.ts#COACH_RESTRICTED_SESSION',
    viewports: [...TARGET_IPHONE_VIEWPORTS],
    mandatoryViewports: [...TARGET_IPHONE_VIEWPORTS],
    criteria: ['touch-target', 'reachability'],
    evidenceKind: 'playwright-webkit-emulation',
    owningSpec: 'e2e/iphone-target-devices.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'attendance.role-scope.chromium',
    surface: 'attendance',
    roleProfileId: 'attendance.spec.ts#administratorAttendanceSession+coachWithoutAssignmentSession',
    viewports: ['390x844'],
    mandatoryViewports: ['390x844'],
    criteria: ['role-access'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/attendance.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'attendance.physical-ios-runtime',
    surface: 'attendance',
    roleProfileId: 'manual#coach-assigned-group',
    viewports: [...TARGET_IPHONE_VIEWPORTS],
    mandatoryViewports: [...TARGET_IPHONE_VIEWPORTS],
    criteria: ['device-runtime', 'reachability'],
    evidenceKind: 'physical-device',
    owningSpec: 'backlog/done/TASK-111-ux-audit-regression-matrix.plan.md#manual-only-checks',
    automationStatus: 'manual-only',
  },
  {
    id: 'settings.touch-order.chromium',
    surface: 'settings',
    roleProfileId: 'settings-tab-title-duplication.spec.ts#HEAD_COACH_SESSION/TASK_111_SETTINGS_VIEWPORTS',
    viewports: [...SETTINGS_CHROMIUM_VIEWPORTS],
    mandatoryViewports: [...SETTINGS_CHROMIUM_VIEWPORTS],
    criteria: ['touch-target', 'target-gap', 'task-order', 'reachability'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/settings-tab-title-duplication.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'settings.page-overflow.chromium',
    surface: 'settings',
    roleProfileId: 'settings-tab-title-duplication.spec.ts#HEAD_COACH_SESSION/TASK_111_SETTINGS_VIEWPORTS',
    viewports: [...SETTINGS_CHROMIUM_VIEWPORTS],
    mandatoryViewports: [...SETTINGS_CHROMIUM_VIEWPORTS],
    criteria: ['page-overflow'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/settings-tab-title-duplication.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'settings.touch-inventory.chromium',
    surface: 'settings',
    roleProfileId: 'touch-target-inventory.spec.ts#ROLE_MATRIX.SuperAdministrator',
    viewports: [...TOUCH_INVENTORY_VIEWPORTS],
    mandatoryViewports: [...TOUCH_INVENTORY_VIEWPORTS],
    criteria: ['touch-target', 'target-gap'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/touch-target-inventory.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'settings.role-administrator.chromium',
    surface: 'settings',
    roleProfileId: 'settings-group-types.spec.ts#ADMIN_SESSION',
    viewports: ['390x844', '912x420', '956x440'],
    mandatoryViewports: ['390x844', '912x420', '956x440'],
    criteria: ['role-access'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/settings-group-types.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'settings.role-super-administrator.chromium',
    surface: 'settings',
    roleProfileId: 'settings-group-types.spec.ts#SUPER_ADMIN_SESSION',
    viewports: ['390x844', '912x420', '956x440'],
    mandatoryViewports: ['390x844', '912x420', '956x440'],
    criteria: ['role-access'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/settings-group-types.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'settings.role-denial.chromium',
    surface: 'settings',
    roleProfileId: 'settings-group-types.spec.ts#COACH_SESSION',
    viewports: ['390x844'],
    mandatoryViewports: ['390x844'],
    criteria: ['role-access'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/settings-group-types.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'settings.physical-ios-runtime',
    surface: 'settings',
    roleProfileId: 'manual#head-coach-global-scope',
    viewports: [...TARGET_IPHONE_VIEWPORTS],
    mandatoryViewports: [...TARGET_IPHONE_VIEWPORTS],
    criteria: ['device-runtime', 'reachability'],
    evidenceKind: 'physical-device',
    owningSpec: 'backlog/done/TASK-111-ux-audit-regression-matrix.plan.md#manual-only-checks',
    automationStatus: 'manual-only',
  },
  {
    id: 'audit.pager-geometry.chromium',
    surface: 'audit',
    roleProfileId: 'responsive-main-screens.spec.ts#ADMIN_AUDIT_SESSION',
    viewports: [...AUDIT_CHROMIUM_VIEWPORTS],
    mandatoryViewports: [...AUDIT_CHROMIUM_VIEWPORTS],
    criteria: ['touch-target', 'target-gap', 'accessible-semantics'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/responsive-main-screens.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'audit.page-overflow.chromium',
    surface: 'audit',
    roleProfileId: 'responsive-main-screens.spec.ts#ADMIN_AUDIT_SESSION',
    viewports: [...AUDIT_CHROMIUM_VIEWPORTS],
    mandatoryViewports: [...AUDIT_CHROMIUM_VIEWPORTS],
    criteria: ['page-overflow'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/responsive-main-screens.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'audit.touch-inventory.chromium',
    surface: 'audit',
    roleProfileId: 'touch-target-inventory.spec.ts#ROLE_MATRIX.SuperAdministrator',
    viewports: [...TOUCH_INVENTORY_VIEWPORTS],
    mandatoryViewports: [...TOUCH_INVENTORY_VIEWPORTS],
    criteria: ['touch-target', 'target-gap', 'accessible-semantics'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/touch-target-inventory.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'audit.pager-focus.webkit',
    surface: 'audit',
    roleProfileId: 'iphone-target-devices.spec.ts#HEAD_COACH_SESSION',
    viewports: [...TARGET_IPHONE_VIEWPORTS],
    mandatoryViewports: [...TARGET_IPHONE_VIEWPORTS],
    criteria: ['touch-target', 'target-gap', 'accessible-semantics', 'focus-return'],
    evidenceKind: 'playwright-webkit-emulation',
    owningSpec: 'e2e/iphone-target-devices.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'audit.role-head-coach.chromium',
    surface: 'audit',
    roleProfileId: 'responsive-main-screens.spec.ts#MANAGEMENT_SESSION',
    viewports: ['390x844'],
    mandatoryViewports: ['390x844'],
    criteria: ['role-access'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/responsive-main-screens.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'audit.role-super-administrator.chromium',
    surface: 'audit',
    roleProfileId: 'responsive-main-screens.spec.ts#SUPER_ADMIN_AUDIT_SESSION',
    viewports: ['390x844'],
    mandatoryViewports: ['390x844'],
    criteria: ['role-access'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/responsive-main-screens.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'audit.role-denial-coach.chromium',
    surface: 'audit',
    roleProfileId: 'route-access-feedback.spec.ts#COACH_SESSION',
    viewports: ['390x844'],
    mandatoryViewports: ['390x844'],
    criteria: ['role-access'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/route-access-feedback.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'audit.physical-ios-runtime',
    surface: 'audit',
    roleProfileId: 'manual#administrator-audit-access',
    viewports: [...TARGET_IPHONE_VIEWPORTS],
    mandatoryViewports: [...TARGET_IPHONE_VIEWPORTS],
    criteria: ['device-runtime', 'reachability'],
    evidenceKind: 'physical-device',
    owningSpec: 'backlog/done/TASK-111-ux-audit-regression-matrix.plan.md#manual-only-checks',
    automationStatus: 'manual-only',
  },
  {
    id: 'schedule.decision-data.chromium',
    surface: 'schedule',
    roleProfileId: 'group-schedule.spec.ts#headCoachSession/denseScheduleGroups',
    viewports: ['1440x1200'],
    mandatoryViewports: ['1440x1200'],
    criteria: ['decision-data', 'accessible-semantics', 'focus-return'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/group-schedule.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'schedule.page-overflow.chromium',
    surface: 'schedule',
    roleProfileId: 'group-schedule.spec.ts#headCoachSession/denseScheduleGroups',
    viewports: ['1440x1200'],
    mandatoryViewports: ['1440x1200'],
    criteria: ['page-overflow'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/group-schedule.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'profile.trigger-geometry.inventory',
    surface: 'profile',
    roleProfileId: 'touch-target-inventory.spec.ts#ROLE_MATRIX.SuperAdministrator',
    viewports: [...TOUCH_INVENTORY_VIEWPORTS],
    mandatoryViewports: [...TOUCH_INVENTORY_VIEWPORTS],
    criteria: ['touch-target', 'target-gap', 'reachability'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/touch-target-inventory.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'profile.page-overflow.inventory',
    surface: 'profile',
    roleProfileId: 'touch-target-inventory.spec.ts#ROLE_MATRIX.SuperAdministrator',
    viewports: [...TOUCH_INVENTORY_VIEWPORTS],
    mandatoryViewports: [...TOUCH_INVENTORY_VIEWPORTS],
    criteria: ['page-overflow'],
    evidenceKind: 'playwright-chromium',
    owningSpec: 'e2e/touch-target-inventory.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'profile.trigger-semantics.webkit',
    surface: 'profile',
    roleProfileId: 'iphone-target-devices.spec.ts#HEAD_COACH_SESSION',
    viewports: [...TARGET_IPHONE_VIEWPORTS],
    mandatoryViewports: [...TARGET_IPHONE_VIEWPORTS],
    criteria: ['touch-target', 'accessible-semantics', 'focus-return', 'reachability'],
    evidenceKind: 'playwright-webkit-emulation',
    owningSpec: 'e2e/iphone-target-devices.spec.ts',
    automationStatus: 'automated-pass',
  },
  {
    id: 'profile.trigger-semantics.component',
    surface: 'profile',
    roleProfileId: 'App.test.tsx#baseSession',
    viewports: ['component-harness'],
    mandatoryViewports: ['component-harness'],
    criteria: ['accessible-semantics', 'focus-return'],
    evidenceKind: 'component-test',
    owningSpec: 'src/App.test.tsx',
    automationStatus: 'automated-pass',
  },
  {
    id: 'profile.physical-ios-runtime',
    surface: 'profile',
    roleProfileId: 'manual#authenticated-user',
    viewports: [...TARGET_IPHONE_VIEWPORTS],
    mandatoryViewports: [...TARGET_IPHONE_VIEWPORTS],
    criteria: ['device-runtime', 'reachability'],
    evidenceKind: 'physical-device',
    owningSpec: 'backlog/done/TASK-111-ux-audit-regression-matrix.plan.md#manual-only-checks',
    automationStatus: 'manual-only',
  },
]

const REQUIRED_SURFACES: readonly UxAuditSurface[] = [
  'attendance',
  'settings',
  'audit',
  'schedule',
  'profile',
]

const STABLE_REQUIREMENT_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/

export function validateUxAuditRegressionMatrix(
  matrix: readonly UxAuditRegressionRequirement[],
  options: { phase?: 'parallel' | 'release' } = {},
): string[] {
  const issues: string[] = []
  const seenIds = new Set<string>()

  for (const surface of REQUIRED_SURFACES) {
    const surfaceRequirements = matrix.filter(
      (requirement) => requirement.surface === surface,
    )

    if (surfaceRequirements.length === 0) {
      issues.push(`missing-surface:${surface}`)
      continue
    }

    if (surfaceRequirements.every(
      (requirement) => requirement.evidenceKind === 'physical-device',
    )) {
      issues.push(`missing-executable-evidence:${surface}`)
    }
  }

  for (const requirement of matrix) {
    if (!STABLE_REQUIREMENT_ID.test(requirement.id)) {
      issues.push(`invalid-requirement-id:${requirement.id}`)
    }

    if (seenIds.has(requirement.id)) {
      issues.push(`duplicate-requirement-id:${requirement.id}`)
    }
    seenIds.add(requirement.id)

    if (requirement.roleProfileId.trim().length === 0) {
      issues.push(`missing-role-profile:${requirement.id}`)
    }
    if (requirement.owningSpec.trim().length === 0) {
      issues.push(`missing-owning-spec:${requirement.id}`)
    }
    if (requirement.viewports.length === 0) {
      issues.push(`missing-viewports:${requirement.id}`)
    }
    if (requirement.criteria.length === 0) {
      issues.push(`missing-criteria:${requirement.id}`)
    }

    const declaredViewports = new Set(requirement.viewports)
    for (const viewport of requirement.mandatoryViewports) {
      if (!declaredViewports.has(viewport)) {
        issues.push(`missing-viewport:${requirement.id}:${viewport}`)
      }
    }

    if (
      requirement.evidenceKind === 'physical-device'
      && requirement.automationStatus === 'automated-pass'
    ) {
      issues.push(`device-only-automated-pass:${requirement.id}`)
    }

    if (
      requirement.criteria.includes('page-overflow')
      && requirement.criteria.includes('decision-data')
    ) {
      issues.push(`conflated-overflow-decision-data:${requirement.id}`)
    }

    if (
      options.phase === 'release'
      && requirement.automationStatus === 'dependency-pending'
    ) {
      issues.push(`dependency-pending:${requirement.id}`)
    }
  }

  return issues
}

export function classifyTouchTarget(box: {
  height: number
  width: number
}): 'insufficient-target'[] {
  return box.width >= 44 && box.height >= 44 ? [] : ['insufficient-target']
}

export function classifyRenderedEvidence(input: {
  bodyScrollWidth: number
  decisionDataComplete: boolean
  documentScrollWidth: number
  viewportWidth: number
}): Array<'decision-data' | 'page-overflow'> {
  const issues: Array<'decision-data' | 'page-overflow'> = []

  if (
    input.documentScrollWidth > input.viewportWidth + 1
    || input.bodyScrollWidth > input.viewportWidth + 1
  ) {
    issues.push('page-overflow')
  }
  if (!input.decisionDataComplete) {
    issues.push('decision-data')
  }

  return issues
}
