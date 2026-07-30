import { describe, expect, test } from 'vitest'
import { deriveClientSearchMode } from './clientListSearchMode'

describe('deriveClientSearchMode', () => {
  test('returns browse when focus is false and normalized query is empty', () => {
    const result = deriveClientSearchMode({
      searchFocused: false,
      searchDraft: '   ',
      query: '   ',
    })

    expect(result).toBe('browse')
  })

  test('returns browse when focus is false and both normalized query and draft are empty', () => {
    const result = deriveClientSearchMode({
      searchFocused: false,
      searchDraft: '',
      query: '',
    })

    expect(result).toBe('browse')
  })

  test('returns search-focused when focus is true even with empty normalized values', () => {
    const result = deriveClientSearchMode({
      searchFocused: true,
      searchDraft: '   ',
      query: '',
    })

    expect(result).toBe('search-focused')
  })

  test('returns search-focused when draft/query has any non-empty normalized text', () => {
    const result = deriveClientSearchMode({
      searchFocused: false,
      searchDraft: '  Иван ',
      query: '',
    })

    expect(result).toBe('search-focused')
  })

  test('derives restored visual mode from normalized applied query without focus', () => {
    expect(
      deriveClientSearchMode({
        searchFocused: false,
        searchDraft: '',
        query: '  восстановленный запрос  ',
      }),
    ).toBe('search-focused')
  })
})
