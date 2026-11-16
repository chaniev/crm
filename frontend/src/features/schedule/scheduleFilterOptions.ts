import type { getScheduleLessons } from '../../lib/api'

export type FilterOption = {
  value: string
  label: string
}

export function emptyFilterOptions() {
  return {
    branches: [] as FilterOption[],
    halls: [] as FilterOption[],
    trainers: [] as FilterOption[],
    groups: [] as FilterOption[],
    groupTypes: [] as FilterOption[],
  }
}

export function mapResponseFilterOptions(
  options: Awaited<ReturnType<typeof getScheduleLessons>>['filterOptions'],
) {
  return {
    branches: options.branches.map(toFilterOption),
    halls: options.halls.map(toFilterOption),
    trainers: options.trainers.map(toFilterOption),
    groups: options.groups.map(toFilterOption),
    groupTypes: options.groupTypes.map(toFilterOption),
  }
}

function toFilterOption(option: { id: string; name: string }) {
  return { value: option.id, label: option.name }
}

