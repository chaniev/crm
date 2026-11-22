import type { GroupTrainerSubstitution } from '../../lib/api'

export function formatPeriod(period: Pick<GroupTrainerSubstitution, 'startsOn' | 'endsOn'>) {
  const date = (value: string) => value.split('-').reverse().join('.')
  return `${date(period.startsOn)} — ${date(period.endsOn)}`
}
