import { describe, expect, test } from 'vitest'
import {
  UX_AUDIT_REGRESSION_MATRIX,
  classifyRenderedEvidence,
  classifyTouchTarget,
  validateUxAuditRegressionMatrix,
  type UxAuditRegressionRequirement,
} from '../../e2e/ux-audit-regression-matrix'

function cloneMatrix(): UxAuditRegressionRequirement[] {
  return UX_AUDIT_REGRESSION_MATRIX.map((requirement) => ({
    ...requirement,
    criteria: [...requirement.criteria],
    mandatoryViewports: [...requirement.mandatoryViewports],
    viewports: [...requirement.viewports],
  }))
}

describe('TASK-111 UX audit regression matrix', () => {
  test('the released matrix is complete and has stable requirement ids', () => {
    expect(validateUxAuditRegressionMatrix(UX_AUDIT_REGRESSION_MATRIX, {
      phase: 'release',
    })).toEqual([])
    expect(UX_AUDIT_REGRESSION_MATRIX.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'attendance.touch-geometry.chromium',
        'settings.touch-order.chromium',
        'audit.pager-focus.webkit',
        'schedule.decision-data.chromium',
        'profile.trigger-semantics.component',
      ]),
    )
  })

  test.each(['attendance', 'settings', 'audit', 'schedule', 'profile'] as const)(
    'rejects a matrix without the %s surface',
    (surface) => {
      const incomplete = cloneMatrix().filter(
        (requirement) => requirement.surface !== surface,
      )

      expect(validateUxAuditRegressionMatrix(incomplete)).toContain(
        `missing-surface:${surface}`,
      )
    },
  )

  test.each(['390x844', '420x912', '440x956', '912x420', '956x440'] as const)(
    'rejects omission of mandatory attendance viewport %s',
    (viewport) => {
      const incomplete = cloneMatrix()
      const attendanceGeometry = incomplete.find(
        ({ id }) => id === 'attendance.touch-geometry.chromium',
      )
      expect(attendanceGeometry).toBeDefined()
      attendanceGeometry!.viewports = attendanceGeometry!.viewports.filter(
        (candidate) => candidate !== viewport,
      )

      expect(validateUxAuditRegressionMatrix(incomplete)).toContain(
        `missing-viewport:attendance.touch-geometry.chromium:${viewport}`,
      )
    },
  )

  test('rejects duplicate and unstable requirement ids', () => {
    const duplicate = cloneMatrix()
    duplicate.push({ ...duplicate[0] })
    expect(validateUxAuditRegressionMatrix(duplicate)).toContain(
      `duplicate-requirement-id:${duplicate[0].id}`,
    )

    const unstable = cloneMatrix()
    unstable[0].id = 'Attendance geometry v1'
    expect(validateUxAuditRegressionMatrix(unstable)).toContain(
      'invalid-requirement-id:Attendance geometry v1',
    )
  })

  test('rejects a physical-device-only check reported as automated pass', () => {
    const invalid = cloneMatrix()
    const deviceOnly = invalid.find(
      ({ evidenceKind }) => evidenceKind === 'physical-device',
    )
    expect(deviceOnly).toBeDefined()
    deviceOnly!.automationStatus = 'automated-pass'

    expect(validateUxAuditRegressionMatrix(invalid)).toContain(
      `device-only-automated-pass:${deviceOnly!.id}`,
    )
  })

  test('rejects one requirement that conflates page overflow and decision data', () => {
    const invalid = cloneMatrix()
    const decisionData = invalid.find(
      ({ id }) => id === 'schedule.decision-data.chromium',
    )
    expect(decisionData).toBeDefined()
    decisionData!.criteria = ['decision-data', 'page-overflow']

    expect(validateUxAuditRegressionMatrix(invalid)).toContain(
      'conflated-overflow-decision-data:schedule.decision-data.chromium',
    )
  })

  test('allows dependency-pending during parallel work but rejects it at release', () => {
    const pending = cloneMatrix()
    pending[0].automationStatus = 'dependency-pending'

    expect(validateUxAuditRegressionMatrix(pending)).not.toContain(
      `dependency-pending:${pending[0].id}`,
    )
    expect(validateUxAuditRegressionMatrix(pending, { phase: 'release' })).toContain(
      `dependency-pending:${pending[0].id}`,
    )
  })

  test.each([
    { width: 32, height: 32 },
    { width: 48, height: 42 },
  ])('classifies a synthetic $width x $height target as insufficient-target', (box) => {
    expect(classifyTouchTarget(box)).toEqual(['insufficient-target'])
  })

  test('reports missing schedule decision data independently from page overflow', () => {
    expect(classifyRenderedEvidence({
      bodyScrollWidth: 1440,
      decisionDataComplete: false,
      documentScrollWidth: 1440,
      viewportWidth: 1440,
    })).toEqual(['decision-data'])
  })
})
