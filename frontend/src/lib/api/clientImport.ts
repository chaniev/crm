import { request } from './transport'
import { isRecord } from './read-helpers'
import { clientImportText } from '../../resources/client-import'

export type ClientImportInput = { file: File; groupName: string; branchId: string; operationId: string }
export type ClientImportResponse = { operationId: string; createdCount: number }
export async function importClients(input: ClientImportInput): Promise<ClientImportResponse> {
  const body = new FormData()
  body.set('operationId', input.operationId)
  body.set('branchId', input.branchId)
  body.set('groupName', input.groupName)
  body.set('file', input.file)
  const result = await request<unknown>('/clients/import-xlsx', { method: 'POST', body })
  if (!isRecord(result) || result.operationId !== input.operationId || !Number.isSafeInteger(result.createdCount) ||
    (result.createdCount as number) < 1 || (result.createdCount as number) > 1000) throw new Error(clientImportText.unknown)
  return { operationId: input.operationId, createdCount: result.createdCount as number }
}
