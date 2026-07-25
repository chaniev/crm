# TASK-088: Заменить silent permission redirects явной обратной связью

## Status
ready

## Priority
P1

## Goal
При открытии недоступного route пользователь понимает ограничение и получает валидное следующее действие, а не неожиданно оказывается на другом экране.

## User role
Любая ограниченная роль, включая тренера и SuperAdministrator без доступа к Finance.

## Problem
Coach при прямом открытии `/groups` или `/users` попадает на `/`, а при `/clients/new` — на `/clients`, без объяснения причины. Silent fallback выглядит как ошибка навигации и не даёт recovery context.

## Scope
- Route guard feedback для restricted read и write routes.
- Явный restricted state или polite notification при automatic replace redirect.
- Valid next action: `На главный экран` или `Открыть доступный раздел`.
- Навигация и доступные operations по-прежнему строятся только из session/backend contract.
- Разделить session loading, unknown route и permission restriction.
- Для SuperAdministrator direct `/finance` показывает явное ограничение и recovery; `Finance` отсутствует в primary navigation и overflow.
- В staff management HeadCoach и peer SuperAdministrator остаются читаемыми read-only targets без доступных edit/deactivate/reactivate controls.
- Create role options для SuperAdministrator поступают из backend и ограничены `Administrator` и `Coach`.

## Out of scope
- Изменение role/permission model.
- Workflow запроса доступа.
- Отображение unusable controls.
- Собственные frontend permission semantics.

## Responsive behavior
- `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`: сообщение и primary recovery action помещаются в одну колонку и доступны без clipping.
- `768 x 1024`, `1440 x 1200`: использовать существующий `PageLayout`/`PageSection`, отдельный modal не требуется.
- `912 x 420`, `956 x 440`: причина и recovery action видимы без бесконечного loader и nested scroll.

## Operational and interaction states
- Permission restricted: явный title, краткая причина и доступный destination.
- Session loading остаётся отдельным временным состоянием.
- Unknown route может использовать отдельный not-found/fallback contract.
- После automatic redirect destination получает корректный document title, а restriction объявляется polite notification.
- При direct URL focus переходит к heading или primary recovery action; обычная навигация не должна получать неожиданный focus theft.
- Direct denied staff mutation возвращает SuperAdministrator к `Users` с сохранённым объяснением, а не к несвязанному fallback.

## Acceptance criteria
- [ ] Restricted route не заканчивается loader или silent fallback без объяснения.
- [ ] Direct URL к restricted section и restricted write route сообщает ограничение до или вместе с redirect.
- [ ] Доступные navigation sections продолжают определяться session contract.
- [ ] Permission-restricted controls не появляются как неработающие.
- [ ] Recovery action ведёт на route, реально доступный текущему пользователю.
- [ ] Для SuperAdministrator `Finance` отсутствует в navigation/overflow, а direct `/finance` объясняет backend permission restriction.
- [ ] HeadCoach и peer SuperAdministrator отображаются read-only; UI не предлагает запрещённые mutation actions.
- [ ] SuperAdministrator не может выбрать `SuperAdministrator` в create-role options, если backend не передал эту роль.

## Test checklist
- [ ] Unit tests route access resolution.
- [ ] E2E restricted section route и restricted write route.
- [ ] E2E SuperAdministrator: `/finance` restriction, protected staff targets и backend-provided create role options.
- [ ] E2E проверяет destination и видимую/announced feedback.
- [ ] Проверить обязательные responsive/compact-height размеры.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: frontend navigation/feedback change, которое должно строго отражать существующий backend session contract.

## Related tasks
- `TASK-087`: schedule scope может использовать scoped empty state, но реализуется независимо.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.

## Visual comparison
- [Сейчас / после](../mockups/usability-2026-07-25/TASK-088-comparison.png)
- [Описание преимуществ и границ макета](../mockups/usability-2026-07-25/README.md#task-088-explicit-permission-restricted-feedback)
