import { createContext, useContext, useEffect } from 'react'

type ReportDraft = (form: string, dirty: boolean) => void

export const MembershipDraftContext = createContext<ReportDraft | null>(null)

export function useMembershipDraft(form: string, dirty: boolean) {
  const report = useContext(MembershipDraftContext)
  useEffect(() => {
    report?.(form, dirty)
    return () => report?.(form, false)
  }, [dirty, form, report])
}
