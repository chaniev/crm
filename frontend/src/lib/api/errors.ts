import { DEFAULT_FIELD_ERROR_MESSAGE } from './endpoints'

type FieldErrorAliases = Record<string, string>

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

export function applyFieldErrors(
  fieldErrors: Record<string, string[]>,
  aliases: FieldErrorAliases = {},
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      resolveFieldPathAlias(field, aliases),
      messages[0] ?? DEFAULT_FIELD_ERROR_MESSAGE,
    ]),
  )
}

function resolveFieldPathAlias(
  field: string,
  aliases: FieldErrorAliases,
) {
  const normalizedFieldPath = normalizeFieldPath(field)

  return aliases[normalizedFieldPath] ?? aliases[field] ?? normalizedFieldPath
}

function normalizeFieldPath(field: string) {
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
