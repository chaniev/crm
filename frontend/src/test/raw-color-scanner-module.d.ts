declare module '*.mjs' {
  export function findViolationsByLine(
    file: string,
    content: string,
  ): Array<{ kind: string }>
  export function findSemanticToneBypassesByLine(
    file: string,
    content: string,
  ): Array<{ kind: string; match: string }>
  export function formatFindings(findings: ReadonlyArray<unknown>): string
  export function groupFindingsByKind(findings: ReadonlyArray<unknown>): string
  export function readAllowlist(pathname: string): Promise<ReadonlyArray<unknown>>
  export function scanRawColors(options: {
    allowlistPath: string
    srcRoot: string
  }): Promise<{ unallowed: unknown[] }>
  export function validateAllowlist(entries: ReadonlyArray<unknown>): void
}
