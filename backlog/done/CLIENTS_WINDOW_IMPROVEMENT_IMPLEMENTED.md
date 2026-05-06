# Реализовано: улучшение окна клиентов

Дата разнесения: 2026-05-06

Источник: бывший `docs/CLIENTS_WINDOW_IMPROVEMENT_PLAN.md`.

## Закрытый срез

Реализован list-first V7-срез окна клиентов:

- список клиентов вынесен из `ClientManagement.tsx` в отдельный feature-срез `frontend/src/features/clients/list/*`;
- добавлены `ClientsListScreen`, `useClientsListState`, `clientListFilters`, `clientListViewModel`, `ClientsToolbar`, `ClientsQuickFilters`, `ClientsResults`, `ClientPreviewPanel`;
- верх экрана стал рабочей панелью списка вместо большого mini-dashboard;
- добавлен единый поиск по имени или телефону для management-ролей и безопасный поиск по имени для `Coach`;
- добавлены status segmented control, group filter, payment filter, expiration range, `Без фото`, размер страницы;
- добавлены quick-фильтры `Без абонемента`, `Скоро закончится`, `Без группы`, `Пробные`;
- список переведен в плотный structured list с колонками `Клиент`, `Статус и абонемент`, `Следующий шаг`, `Группа`, `Визит`;
- добавлен selected row и desktop preview с lazy-load `GET /clients/{id}`;
- preview показывает краткую карточку, главный следующий шаг, факты и последние события;
- loading/error/empty состояния приведены к общим `Skeleton`, `ErrorState`, `EmptyState`;
- mobile не показывает desktop preview и не дает горизонтальный scroll.

Backend/frontend contract для V7 реализован:

- `GET /clients` возвращает envelope с `items`, `totalCount`, `activeCount`, `archivedCount`, paging и `hasNextPage`;
- добавлены unified `query/search`;
- добавлены list-поля `currentMembershipSummary`, `membershipState`, `lastVisitDate`;
- добавлены фильтры `membershipState`, `membershipType`, `membershipExpiresFrom`, `membershipExpiresTo`, `hasCurrentMembership`;
- `Coach` не получает телефон, payment amount и лишнюю membership history сверх разрешенного backend-среза;
- frontend API modules маппят новый contract в `ClientListItem`.

## Связанные проверки, зафиксированные в закрытых планах

Подтверждения реализации и проверок находятся в:

- `backlog/done/CLIENTS_WINDOW_V7_IMPLEMENTATION_PLAN.md`;
- `backlog/done/REFACTORING_PLAN.md`;
- `backlog/done/plan-izmeneniy-gym-crm.md`.

При переносе документации 2026-05-06 новые проверки не запускались.
