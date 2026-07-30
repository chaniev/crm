export type ClientSearchMode = 'browse' | 'search-focused'

type DeriveClientSearchModeInput = {
  searchFocused: boolean
  searchDraft: string
  query: string
}

export function deriveClientSearchMode({
  searchFocused,
  searchDraft,
  query,
}: DeriveClientSearchModeInput): ClientSearchMode {
  if (searchFocused) {
    return 'search-focused'
  }

  return searchDraft.trim() || query.trim() ? 'search-focused' : 'browse'
}
