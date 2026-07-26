import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import type { TrainingGroupSummary } from '../../lib/api'

type GroupsSummaryBarProps = {
  summary: TrainingGroupSummary | null
  loading: boolean
  error: string | null
  onCreate: () => void
  onRefresh: () => void
}

export function GroupsSummaryBar({
  summary,
  loading,
  error,
  onCreate,
  onRefresh,
}: GroupsSummaryBarProps) {
  const value = (count: number | undefined) => loading || error ? '—' : String(count ?? 0)

  return (
    <section
      aria-labelledby="groups-summary-title"
      className="groups-summary-bar"
      data-testid="groups-summary-bar"
    >
      <h2 className="groups-screen__visually-hidden" id="groups-summary-title">
        Сводка и действия групп
      </h2>
      <dl className="groups-summary-bar__metrics">
        <div className="groups-summary-bar__metric">
          <dt>Всего</dt>
          <dd>{value(summary?.totalCount)}</dd>
        </div>
        <div className="groups-summary-bar__metric">
          <dt>
            Без тренера
            <span className="groups-screen__visually-hidden"> среди активных</span>
          </dt>
          <dd>{value(summary?.activeWithoutTrainerCount)}</dd>
        </div>
      </dl>
      <div aria-label="Действия с группами" className="groups-summary-bar__actions" role="group">
        <Button className="groups-summary-bar__create" color="var(--crm-brand-secondary)" onClick={onCreate}>
          Создать
        </Button>
        <Tooltip label="Обновить список">
          <ActionIcon
            aria-label="Обновить список"
            className="groups-summary-bar__refresh"
            loading={loading}
            onClick={onRefresh}
            size={44}
            variant="light"
          >
            <IconRefresh aria-hidden="true" size={20} />
          </ActionIcon>
        </Tooltip>
      </div>
      <span aria-live="polite" className="groups-screen__visually-hidden" role="status">
        {loading ? 'Сводка загружается' : error ? `Сводка не загрузилась: ${error}` : 'Сводка загружена'}
      </span>
    </section>
  )
}
